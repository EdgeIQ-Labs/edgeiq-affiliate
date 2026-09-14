import { Hono } from 'hono';
import { z } from 'zod';
import { eq, sql, desc, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { partners, trackingEvents, conversions } from '@relay/core/schema';
import { getDb } from '@relay/core/db';
import { generatePartnerToken, type PartnerEnv } from '../middleware/partner-auth.js';

export const partnerPortal = new Hono<PartnerEnv>();

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

function randomReferralCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

// POST /signup — public, no auth required
partnerPortal.post('/signup', async (c) => {
  const db = getDb();
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  // Generate unique referral code with collision retry
  let referralCode = '';
  for (let i = 0; i < 10; i++) {
    const candidate = randomReferralCode();
    const existing = await db.select({ id: partners.id })
      .from(partners)
      .where(eq(partners.referralCode, candidate))
      .limit(1);
    if (existing.length === 0) {
      referralCode = candidate;
      break;
    }
  }
  if (!referralCode) {
    return c.json({ error: 'Could not generate unique referral code' }, 500);
  }

  try {
    const [partner] = await db.insert(partners).values({
      email: parsed.data.email,
      name: parsed.data.name,
      referralCode,
      status: 'pending',
    }).returning();

    const token = generatePartnerToken(partner.id);

    return c.json({
      id: partner.id,
      email: partner.email,
      name: partner.name,
      referral_code: partner.referralCode,
      status: partner.status,
      created_at: partner.createdAt,
      token,
    }, 201);
  } catch (err: any) {
    if (err.code === '23505') {
      return c.json({ error: 'Email already registered' }, 409);
    }
    throw err;
  }
});

// GET /me
partnerPortal.get('/me', async (c) => {
  const db = getDb();
  const partnerId = c.get('partnerId');

  const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
  if (!partner) {
    return c.json({ error: 'Partner not found' }, 404);
  }

  return c.json({
    id: partner.id,
    email: partner.email,
    name: partner.name,
    referral_code: partner.referralCode,
    status: partner.status,
    created_at: partner.createdAt,
  });
});

// GET /stats
partnerPortal.get('/stats', async (c) => {
  const db = getDb();
  const partnerId = c.get('partnerId');

  const [clicksRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.partnerId, partnerId), eq(trackingEvents.eventType, 'click')));

  const [conversionsRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(conversions)
    .where(eq(conversions.partnerId, partnerId));

  const [revenueRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${conversions.amountCents}), 0)` })
    .from(conversions)
    .where(eq(conversions.partnerId, partnerId));

  const [commissionsRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` })
    .from(conversions)
    .where(eq(conversions.partnerId, partnerId));

  const [pendingRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` })
    .from(conversions)
    .where(and(eq(conversions.partnerId, partnerId), eq(conversions.status, 'pending')));

  const [paidRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` })
    .from(conversions)
    .where(and(eq(conversions.partnerId, partnerId), eq(conversions.status, 'paid')));

  return c.json({
    totalClicks: Number(clicksRow?.total ?? 0),
    totalConversions: Number(conversionsRow?.total ?? 0),
    totalRevenueCents: Number(revenueRow?.total ?? 0),
    totalCommissionsCents: Number(commissionsRow?.total ?? 0),
    pendingCommissionsCents: Number(pendingRow?.total ?? 0),
    paidCommissionsCents: Number(paidRow?.total ?? 0),
  });
});

// GET /clicks
partnerPortal.get('/clicks', async (c) => {
  const db = getDb();
  const partnerId = c.get('partnerId');

  const rows = await db
    .select({
      visitorId: trackingEvents.visitorId,
      createdAt: trackingEvents.createdAt,
      metadata: trackingEvents.metadata,
    })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.partnerId, partnerId), eq(trackingEvents.eventType, 'click')))
    .orderBy(desc(trackingEvents.createdAt))
    .limit(50);

  return c.json(rows.map(r => ({
    visitor_id: r.visitorId,
    created_at: r.createdAt,
    metadata: r.metadata,
  })));
});

// GET /conversions
partnerPortal.get('/conversions', async (c) => {
  const db = getDb();
  const partnerId = c.get('partnerId');

  const rows = await db
    .select({
      planId: conversions.planId,
      amountCents: conversions.amountCents,
      commissionCents: conversions.commissionCents,
      status: conversions.status,
      createdAt: conversions.createdAt,
    })
    .from(conversions)
    .where(eq(conversions.partnerId, partnerId))
    .orderBy(desc(conversions.createdAt))
    .limit(50);

  return c.json(rows.map(r => ({
    plan_id: r.planId,
    amount_cents: r.amountCents,
    commission_cents: r.commissionCents,
    status: r.status,
    created_at: r.createdAt,
  })));
});

// GET /link
partnerPortal.get('/link', async (c) => {
  const db = getDb();
  const partnerId = c.get('partnerId');

  const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
  if (!partner) {
    return c.json({ error: 'Partner not found' }, 404);
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
  const referralLink = `${baseUrl}/r/${partner.referralCode}`;

  return c.json({
    referral_link: referralLink,
    referral_code: partner.referralCode,
  });
});
