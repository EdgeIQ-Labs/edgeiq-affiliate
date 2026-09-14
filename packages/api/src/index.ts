import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { tracking } from './routes/tracking.js';
import { webhooks } from './routes/webhooks.js';
import { admin } from './routes/admin.js';
import { adminAuth } from './middleware/auth.js';
import { partnerPortal } from './routes/partner-portal.js';
import { partnerAuth } from './middleware/partner-auth.js';

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

// Mount webhook routes (raw body read happens inside handler)
app.route('/', webhooks);

// List partners (public/legacy)
app.get('/api/partners', async (c) => {
  return c.json({
    data: [],
    message: 'Partners endpoint — database integration pending',
  });
});

// Mount admin routes with auth middleware
app.use('/api/admin/*', adminAuth);
app.route('/api/admin', admin);

// Mount partner portal routes with auth middleware (except signup)
app.use('/api/partner/*', async (c, next) => {
  if (c.req.path === '/api/partner/signup' && c.req.method === 'POST') {
    return next();
  }
  return partnerAuth(c as any, next);
});
app.route('/api/partner', partnerPortal);

const port = Number(process.env.PORT) || 3000;

console.log(`Relay API listening on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
