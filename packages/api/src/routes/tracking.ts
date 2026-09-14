import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { partners, trackingEvents } from '@relay/core/schema';
import { getDb } from '@relay/core/db';
import { generateVisitorId, COOKIE_NAME, COOKIE_MAX_AGE } from '@relay/core/visitor';
import { buildCheckoutUrl } from '@relay/core/checkout';

export const tracking = new Hono();

tracking.get('/r/:code', async (c) => {
  const code = c.req.param('code');

  try {
    const database = getDb();

    // Look up partner by referral_code
    const results = await database
      .select()
      .from(partners)
      .where(eq(partners.referralCode, code))
      .limit(1);

    const partner = results[0];

    if (!partner || partner.status !== 'approved') {
      return c.notFound();
    }

    // Generate visitor ID
    const visitorId = generateVisitorId();

    // Extract IP from proxy headers
    const xff = c.req.header('x-forwarded-for');
    const ip = xff ? xff.split(',')[0].trim() : (c.req.header('x-real-ip') ?? 'unknown');
    const userAgent = c.req.header('user-agent') ?? null;
    const referer = c.req.header('referer') ?? null;

    // Insert tracking event
    await database.insert(trackingEvents).values({
      partnerId: partner.id,
      visitorId,
      eventType: 'click',
      metadata: {
        userAgent,
        ip,
        referer,
      },
    });

    // Determine checkout URL
    const defaultCheckoutUrl = process.env.DEFAULT_CHECKOUT_URL;
    if (!defaultCheckoutUrl) {
      console.error('[Tracking] DEFAULT_CHECKOUT_URL is not configured');
      return c.json({ error: 'Checkout URL not configured' }, 500);
    }

    // Build redirect URL with client_reference_id
    const redirectUrl = buildCheckoutUrl(defaultCheckoutUrl, visitorId);

    // Set cookie options
    const cookieDomain = process.env.COOKIE_DOMAIN;
    let cookieStr = `${COOKIE_NAME}=${visitorId}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    if (cookieDomain) {
      cookieStr += `; Domain=${cookieDomain}`;
    }

    c.header('Set-Cookie', cookieStr);

    return c.redirect(redirectUrl, 302);
  } catch (err) {
    console.error('[Tracking] Error processing click:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
