import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { tracking } from './routes/tracking.js';

const app = new Hono();

// Request logging middleware with duration
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
});

// CORS for API routes
app.use('/api/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount tracking routes
app.route('/', tracking);

// Stripe webhook receiver
app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  const body = await c.req.text();

  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not configured');
  }

  try {
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
