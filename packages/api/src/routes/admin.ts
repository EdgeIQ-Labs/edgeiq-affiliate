import { Hono } from 'hono';
import { z } from 'zod';
import { eq, sql, desc } from 'drizzle-orm';
import { partners, conversions, commissionRules, payouts } from '@relay/core/schema';
import { getDb } from '@relay/core/db';

export const admin = new Hono();

// GET /api/admin/dashboard
admin.get('/dashboard', async (c) => {
  const db = getDb();

  const [revenueResult] = await db.select({ total: sql<number>`COALESCE(SUM(${conversions.amountCents}), 0)` }).from(conversions);
  const [owedResult] = await db.select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` }).from(conversions).where(eq(conversions.status, 'pending'));
  const [paidResult] = await db.select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` }).from(conversions).where(eq(conversions.status, 'paid'));
  const [partnersCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(partners);
  const [conversionsCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(conversions);

  return c.json({
    totalReferredRevenueCents: Number(revenueResult?.total ?? 0),
    totalCommissionsOwedCents: Number(owedResult?.total ?? 0),
    totalCommissionsPaidCents: Number(paidResult?.total ?? 0),
    totalPartners: Number(partnersCount?.count ?? 0),
    totalConversions: Number(conversionsCount?.count ?? 0),
  });
});

// GET /api/admin/partners
admin.get('/partners', async (c) => {
  const db = getDb();
  const statusFilter = c.req.query('status');

  let query = db.select().from(partners).orderBy(desc(partners.createdAt));
  if (statusFilter === 'pending' || statusFilter === 'approved' || statusFilter === 'suspended') {
    query = query.where(eq(partners.status, statusFilter)) as typeof query;
  }

  const result = await query;
  return c.json(result);
});

// POST /api/admin/partners
const createPartnerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  referral_code: z.string().min(1),
});

admin.post('/partners', async (c) => {
  const db = getDb();
  const body = await c.req.json();
  const parsed = createPartnerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  try {
    const [partner] = await db.insert(partners).values({
      email: parsed.data.email,
      name: parsed.data.name,
      referralCode: parsed.data.referral_code,
      status: 'approved',
    }).returning();

    return c.json(partner, 201);
  } catch (err: any) {
    if (err.code === '23505') {
      return c.json({ error: 'Referral code or email already exists' }, 409);
    }
    throw err;
  }
});

// PATCH /api/admin/partners/:id
const updatePartnerSchema = z.object({
  status: z.enum(['approved', 'suspended']),
});

admin.patch('/partners/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updatePartnerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const [updated] = await db.update(partners)
    .set({ status: parsed.data.status })
    .where(eq(partners.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: 'Partner not found' }, 404);
  }

  return c.json(updated);
});

// DELETE /api/admin/partners/:id
admin.delete('/partners/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const [deleted] = await db.delete(partners)
    .where(eq(partners.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Partner not found' }, 404);
  }

  return c.body(null, 204);
});

// GET /api/admin/conversions
admin.get('/conversions', async (c) => {
  const db = getDb();
  const partnerId = c.req.query('partner_id');

  let query = db.select({
    id: conversions.id,
    partnerId: conversions.partnerId,
    partnerName: partners.name,
    partnerEmail: partners.email,
    planId: conversions.planId,
    amountCents: conversions.amountCents,
    commissionCents: conversions.commissionCents,
    status: conversions.status,
    createdAt: conversions.createdAt,
  })
  .from(conversions)
  .leftJoin(partners, eq(conversions.partnerId, partners.id))
  .orderBy(desc(conversions.createdAt))
  .limit(100);

  if (partnerId) {
    query = query.where(eq(conversions.partnerId, partnerId)) as typeof query;
  }

  const result = await query;
  return c.json(result);
});

// GET /api/admin/rules
admin.get('/rules', async (c) => {
  const db = getDb();
  const result = await db.select().from(commissionRules);
  return c.json(result);
});

// POST /api/admin/rules
const upsertRuleSchema = z.object({
  plan_id: z.string().min(1),
  type: z.enum(['percent', 'fixed']),
  value: z.number(),
  active: z.boolean(),
});

admin.post('/rules', async (c) => {
  const db = getDb();
  const body = await c.req.json();
  const parsed = upsertRuleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  const existing = await db.select().from(commissionRules).where(eq(commissionRules.planId, parsed.data.plan_id)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(commissionRules)
      .set({ type: parsed.data.type, value: String(parsed.data.value), active: parsed.data.active })
      .where(eq(commissionRules.id, existing[0].id))
      .returning();
    return c.json(updated);
  }

  const [inserted] = await db.insert(commissionRules)
    .values({
      planId: parsed.data.plan_id,
      type: parsed.data.type,
      value: String(parsed.data.value),
      active: parsed.data.active,
    })
    .returning();

  return c.json(inserted, 201);
});

// GET /api/admin/payouts
admin.get('/payouts', async (c) => {
  const db = getDb();
  const result = await db.select({
    partner_id: conversions.partnerId,
    partner_name: partners.name,
    partner_email: partners.email,
    pending_amount_cents: sql<number>`SUM(${conversions.commissionCents})`,
  })
  .from(conversions)
  .innerJoin(partners, eq(conversions.partnerId, partners.id))
  .where(eq(conversions.status, 'pending'))
  .groupBy(conversions.partnerId, partners.name, partners.email);

  return c.json(result.map(r => ({
    partner_id: r.partner_id,
    partner_name: r.partner_name,
    partner_email: r.partner_email,
    pending_amount_cents: Number(r.pending_amount_cents),
  })));
});

// POST /api/admin/payouts/:partnerId/mark-paid
admin.post('/payouts/:partnerId/mark-paid', async (c) => {
  const db = getDb();
  const partnerId = c.req.param('partnerId');

  const [totalRow] = await db.select({ total: sql<number>`COALESCE(SUM(${conversions.commissionCents}), 0)` })
    .from(conversions)
    .where(sql`${conversions.partnerId} = ${partnerId} AND ${conversions.status} = 'pending'`);

  const totalAmount = Number(totalRow?.total ?? 0);

  await db.update(conversions)
    .set({ status: 'paid' })
    .where(sql`${conversions.partnerId} = ${partnerId} AND ${conversions.status} = 'pending'`);

  await db.insert(payouts).values({
    partnerId,
    amountCents: totalAmount,
    method: 'manual',
    status: 'paid',
  });

  return c.json({ message: 'Payout marked as paid', amount_cents: totalAmount });
});
