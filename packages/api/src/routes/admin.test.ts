import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { admin } from './admin.js';
import { adminAuth } from '../middleware/auth.js';

// Mock the database layer
const mockDb = {
  select: vi.fn(() => mockDb),
  insert: vi.fn(() => mockDb),
  update: vi.fn(() => mockDb),
  delete: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  leftJoin: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  groupBy: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  returning: vi.fn(() => mockDb),
};

vi.mock('@relay/core/db', () => ({
  getDb: () => mockDb,
}));

function createApp() {
  const app = new Hono();
  app.use('/api/admin/*', adminAuth);
  app.route('/api/admin', admin);
  return app;
}

const AUTH_HEADER = { Authorization: 'Bearer change-me-to-random-string' };

describe('Admin API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = 'change-me-to-random-string';
    app = createApp();
  });

  it('returns 401 without valid Authorization header', async () => {
    const res = await app.request('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/dashboard returns aggregated stats', async () => {
    // Chain: select().from(conversions) -> [{ total: 5000 }]
    // We need to handle multiple calls. Let's make select return different things based on call count.
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return mockDb;
    });
    // For simplicity in unit tests with chained mocks, we resolve the final promise
    // Since there are 5 queries, we'll mock them sequentially via a trick:
    // Actually, the simplest approach for chained drizzle mocks is to make the chain resolve.
    // But since each query is awaited separately, we can use mockResolvedValue on the final thenable.
    
    // A simpler approach: mock the entire db object to return resolved values per query type
    // For this test suite, let's just verify the route structure and auth work.
    // Full integration tests would use a real DB. Here we test the happy path with mocked chains.
    
    // Reset and setup specific mock behavior
    const mockResult = Promise.resolve([{ total: 1000, count: 5 }]);
    Object.assign(mockDb, {
      then: (resolve: any) => mockResult.then(resolve),
    });

    const res = await app.request('/api/admin/dashboard', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('totalReferredRevenueCents');
    expect(data).toHaveProperty('totalPartners');
  });

  it('GET /api/admin/partners returns all partners', async () => {
    const partners = [{ id: '1', name: 'Test', email: 't@t.com', referralCode: 'ABC', status: 'approved' }];
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve(partners).then(resolve),
    });

    const res = await app.request('/api/admin/partners', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/admin/partners?status=pending filters correctly', async () => {
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([]).then(resolve),
    });

    const res = await app.request('/api/admin/partners?status=pending', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('POST /api/admin/partners creates partner successfully', async () => {
    const newPartner = { id: '1', email: 'a@b.com', name: 'A', referralCode: 'X', status: 'approved' };
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([newPartner]).then(resolve),
    });

    const res = await app.request('/api/admin/partners', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', name: 'A', referral_code: 'X' }),
    });
    expect(res.status).toBe(201);
  });

  it('POST /api/admin/partners with duplicate code returns 409', async () => {
    const err: any = new Error('duplicate');
    err.code = '23505';
    Object.assign(mockDb, {
      then: (_resolve: any, reject: any) => Promise.reject(err).catch(reject),
    });

    const res = await app.request('/api/admin/partners', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', name: 'A', referral_code: 'X' }),
    });
    expect(res.status).toBe(409);
  });

  it('PATCH /api/admin/partners/:id updates status', async () => {
    const updated = { id: '1', status: 'suspended' };
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([updated]).then(resolve),
    });

    const res = await app.request('/api/admin/partners/1', {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/admin/partners/:id removes partner', async () => {
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([{ id: '1' }]).then(resolve),
    });

    const res = await app.request('/api/admin/partners/1', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(204);
  });

  it('GET /api/admin/conversions returns joined data', async () => {
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([{ id: '1', partnerName: 'P' }]).then(resolve),
    });

    const res = await app.request('/api/admin/conversions', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
  });

  it('POST /api/admin/rules upserts commission rule', async () => {
    const rule = { id: '1', planId: 'pro', type: 'percent', value: '10', active: true };
    // First call: select existing (empty), second call: insert
    let callIdx = 0;
    Object.assign(mockDb, {
      then: (resolve: any) => {
        callIdx++;
        if (callIdx === 1) return Promise.resolve([]).then(resolve);
        return Promise.resolve([rule]).then(resolve);
      },
    });

    const res = await app.request('/api/admin/rules', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: 'pro', type: 'percent', value: 10, active: true }),
    });
    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/admin/payouts aggregates pending commissions', async () => {
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([{
        partner_id: '1',
        partner_name: 'P',
        partner_email: 'p@p.com',
        pending_amount_cents: 500,
      }]).then(resolve),
    });

    const res = await app.request('/api/admin/payouts', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>[];
    expect(data[0]).toHaveProperty('pending_amount_cents');
  });

  it('POST /api/admin/payouts/:id/mark-paid updates conversions and creates payout', async () => {
    // Multiple queries: select sum, update, insert
    let step = 0;
    Object.assign(mockDb, {
      then: (resolve: any) => {
        step++;
        if (step === 1) return Promise.resolve([{ total: 1000 }]).then(resolve);
        if (step === 2) return Promise.resolve([]).then(resolve); // update
        return Promise.resolve([]).then(resolve); // insert
      },
    });

    const res = await app.request('/api/admin/payouts/partner-1/mark-paid', {
      method: 'POST',
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.message).toContain('paid');
  });
});
