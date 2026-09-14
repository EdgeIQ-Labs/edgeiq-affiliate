import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Click tracking redirect
app.get('/r/:code', async (c) => {
  const code = c.req.param('code');
  const visitorId = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';

  // TODO: Look up partner by referral_code, record click event in DB
  console.log(`[Tracking] Click for code=${code} from visitor=${visitorId}`);

  // Redirect to signup/home page
  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://edgeiq.io';
  return c.redirect(`${baseUrl}?ref=${encodeURIComponent(code)}`, 302);
});

// Stripe webhook receiver
app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  const body = await c.req.text();

  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  // TODO: Verify Stripe webhook signature using STRIPE_WEBHOOK_SECRET
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not configured');
  }

  try {
    // Placeholder: parse and handle the event
    const event = JSON.parse(body);
    console.log(`[Stripe] Received event: ${event.type ?? 'unknown'}`);
    return c.json({ received: true });
  } catch (err) {
    console.error('[Stripe] Webhook processing failed:', err);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// List partners
app.get('/api/partners', async (c) => {
  // TODO: Query partners from database via Drizzle
  return c.json({
    data: [],
    message: 'Partners endpoint — database integration pending',
  });
});

const port = Number(process.env.PORT) || 3000;

console.log(`Relay API listening on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
