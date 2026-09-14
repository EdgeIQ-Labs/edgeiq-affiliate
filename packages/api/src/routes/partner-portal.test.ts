import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { partnerPortal } from './partner-portal.js';
import { partnerAuth } from '../middleware/partner-auth.js';
import { generatePartnerToken } from '../middleware/partner-auth.js';

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
  // Apply auth to all partner routes except signup
  app.use('/api/partner/*', async (c, next) => {
    if (c.req.path === '/api/partner/signup' && c.req.method === 'POST') {
      return next();
    }
    return partnerAuth(c as any, next);
  });
  app.route('/api/partner', partnerPortal);
  return app;
}

describe('Partner Portal API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PARTNER_SECRET = 'test-secret';
    process.env.PUBLIC_BASE_URL = 'https://relay.example.com';
    app = createApp();
  });

  it('POST /api/partner/signup creates partner with pending status and returns token', async () => {
    const newPartner = {
      id: 'uuid-1',
      email: 'partner@test.com',
      name: 'Test Partner',
      referralCode: 'abc12345',
      status: 'pending',
      createdAt: new Date(),
    };

    // First call: check referral code collision (returns empty)
    // Second call: insert returning
    let callCount = 0;
    Object.assign(mockDb, {
      then: (resolve: any) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([]).then(resolve); // collision check
        return Promise.resolve([newPartner]).then(resolve); // insert
      },
    });

    const res = await app.request('/api/partner/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'partner@test.com', name: 'Test Partner' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('token');
    expect(data.status).toBe('pending');
    expect(data.email).toBe('partner@test.com');
    expect(data.referral_code).toBe('abc12345');
  });

  it('POST /api/partner/signup with duplicate email returns 409', async () => {
    const err: any = new Error('duplicate');
    err.code = '23505';

    let callCount = 0;
    Object.assign(mockDb, {
      then: (resolve: any, reject: any) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([]).then(resolve); // collision check
        return Promise.reject(err).catch(reject); // insert fails
      },
    });

    const res = await app.request('/api/partner/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@test.com', name: 'Dup' }),
    });

    expect(res.status).toBe(409);
  });

  it('GET /api/partner/me returns correct profile with valid token', async () => {
    const partnerId = 'uuid-1';
    const token = generatePartnerToken(partnerId);
    const partner = {
      id: partnerId,
      email: 'p@test.com',
      name: 'P',
      referralCode: 'ref123',
      status: 'approved',
      createdAt: new Date(),
    };

    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([partner]).then(resolve),
    });

    const res = await app.request('/api/partner/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.id).toBe(partnerId);
    expect(data.email).toBe('p@test.com');
  });

  it('GET /api/partner/me without token returns 401', async () => {
    const res = await app.request('/api/partner/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/partner/stats returns correct aggregated numbers', async () => {
    const partnerId = 'uuid-1';
    const token = generatePartnerToken(partnerId);

    // 6 sequential queries in stats endpoint
    const results = [
      [{ total: 100 }],   // clicks count
      [{ total: 10 }],    // conversions count
      [{ total: 50000 }], // revenue sum
      [{ total: 5000 }],  // commissions sum
      [{ total: 3000 }],  // pending sum
      [{ total: 2000 }],  // paid sum
    ];
    let step = 0;
    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve(results[step++] || [{ total: 0 }]).then(resolve),
    });

    const res = await app.request('/api/partner/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.totalClicks).toBe(100);
    expect(data.totalConversions).toBe(10);
    expect(data.totalRevenueCents).toBe(50000);
    expect(data.totalCommissionsCents).toBe(5000);
    expect(data.pendingCommissionsCents).toBe(3000);
    expect(data.paidCommissionsCents).toBe(2000);
  });

  it('GET /api/partner/clicks returns only this partners clicks', async () => {
    const partnerId = 'uuid-1';
    const token = generatePartnerToken(partnerId);
    const clicks = [
      { visitorId: 'v1', createdAt: new Date(), metadata: { ip: '1.2.3.4' } },
      { visitorId: 'v2', createdAt: new Date(), metadata: null },
    ];

    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve(clicks).then(resolve),
    });

    const res = await app.request('/api/partner/clicks', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>[];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('visitor_id');
    expect(data[0]).toHaveProperty('metadata');
  });

  it('GET /api/partner/conversions returns only this partners conversions', async () => {
    const partnerId = 'uuid-1';
    const token = generatePartnerToken(partnerId);
    const convs = [
      { planId: 'pro', amountCents: 5000, commissionCents: 500, status: 'pending', createdAt: new Date() },
    ];

    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve(convs).then(resolve),
    });

    const res = await app.request('/api/partner/conversions', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>[];
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('plan_id');
    expect(data[0]).toHaveProperty('commission_cents');
  });

  it('GET /api/partner/link constructs correct URL', async () => {
    const partnerId = 'uuid-1';
    const token = generatePartnerToken(partnerId);
    const partner = {
      id: partnerId,
      referralCode: 'mycode88',
    };

    Object.assign(mockDb, {
      then: (resolve: any) => Promise.resolve([partner]).then(resolve),
    });

    const res = await app.request('/api/partner/link', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.referral_link).toBe('https://relay.example.com/r/mycode88');
    expect(data.referral_code).toBe('mycode88');
  });

  it('tampered partner token is rejected', async () => {
    const token = generatePartnerToken('uuid-1');
    // Tamper with the token by changing a character
    const tampered = token.slice(0, -2) + 'XX';

    const res = await app.request('/api/partner/me', {
      headers: { Authorization: `Bearer ${tampered}` },
    });

    expect(res.status).toBe(401);
  });
});
