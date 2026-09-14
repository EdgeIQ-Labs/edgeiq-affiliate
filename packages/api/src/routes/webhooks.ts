import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { verifyStripeSignature } from '@relay/core/stripe';
import { trackingEvents, conversions, commissionRules } from '@relay/core/schema';
import { getDb } from '@relay/core/db';

export const webhooks = new Hono();

async function calculateCommission(planId: string, amountCents: number): Promise<number> {
  const database = getDb();
  const rules = await database
    .select()
    .from(commissionRules)
    .where(and(eq(commissionRules.planId, planId), eq(commissionRules.active, true)))
    .limit(1);

  if (rules.length === 0) return 0;

  const rule = rules[0];
  const value = Number(rule.value);

  if (rule.type === 'percent') {
    return Math.round(amountCents * (value / 100));
  }
  // fixed: value is in cents
  return Math.round(value);
}

async function handleNewConversion(event: any): Promise<void> {
  const session = event.data?.object;
  if (!session) return;

  const clientReferenceId = session.client_reference_id;
  if (!clientReferenceId) {
    console.warn('[Webhook] checkout.session.completed without client_reference_id — ignoring');
    return;
  }

  const database = getDb();

  // Look up the most recent click for this visitor
  const clicks = await database
    .select()
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.visitorId, clientReferenceId),
        eq(trackingEvents.eventType, 'click')
      )
    )
    .orderBy(desc(trackingEvents.createdAt))
    .limit(1);

  if (clicks.length === 0) {
    console.warn(`[Webhook] No matching click found for visitor_id=${clientReferenceId}`);
    return;
  }

  const click = clicks[0];
  const partnerId = click.partnerId;

  // Extract plan_id from metadata or fall back to a default
  const planId = session.metadata?.plan_id ?? session.metadata?.planId ?? 'default';
  const amountCents = session.amount_total ?? 0;

  const commissionCents = await calculateCommission(planId, amountCents);

  await database.insert(conversions).values({
    partnerId,
    stripeCheckoutSessionId: session.id,
    planId,
    amountCents,
    commissionCents,
    status: 'pending',
  });

  console.log(
    `[Webhook] Conversion created: partner=${partnerId} session=${session.id} amount=${amountCents} commission=${commissionCents}`
  );
}

async function handleRecurringCommission(event: any): Promise<void> {
  const invoice = event.data?.object;
  if (!invoice) return;

  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) {
    console.warn('[Webhook] invoice.paid without subscription ID — ignoring');
    return;
  }

  const database = getDb();

  // Find original conversion linked to this subscription's checkout session
  const existing = await database
    .select()
    .from(conversions)
    .where(eq(conversions.stripeCheckoutSessionId, subscriptionId))
    .limit(1);

  // Also try matching by subscription stored in checkout session ID field
  let original = existing[0];
  if (!original) {
    // The subscription ID may differ from the checkout session ID.
    // Try finding any conversion that references this subscription.
    const bySub = await database
      .select()
      .from(conversions)
      .where(eq(conversions.stripeCheckoutSessionId, subscriptionId))
      .limit(1);
    original = bySub[0];
  }

  if (!original) {
    console.warn(`[Webhook] No original conversion found for subscription=${subscriptionId}`);
    return;
  }

  const amountCents = invoice.amount_paid ?? 0;
  const commissionCents = await calculateCommission(original.planId, amountCents);

  await database.insert(conversions).values({
    partnerId: original.partnerId,
    stripeCheckoutSessionId: subscriptionId,
    planId: original.planId,
    amountCents,
    commissionCents,
    status: 'pending',
  });

  console.log(
    `[Webhook] Recurring commission created: partner=${original.partnerId} subscription=${subscriptionId} amount=${amountCents} commission=${commissionCents}`
  );
}

webhooks.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  // Read raw body — critical for signature verification
  const rawBody = await c.req.text();

  const isValid = verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.warn('[Webhook] Invalid Stripe signature');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleNewConversion(event);
        break;
      case 'invoice.paid':
        await handleRecurringCommission(event);
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Webhook] Error processing ${event.type}:`, err);
    // Still return 200 to prevent Stripe retries for errors we've logged
  }

  return c.json({ received: true });
});
