import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature, STRIPE_TOLERANCE_SECONDS } from '@relay/core/stripe';
import app from '../index.js';

// Mock the database module
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('@relay/core/db', () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
  }),
}));

// Chain builder for select queries
function setupSelectChain(result: any[] = []) {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(result);
}

const WEBHOOK_SECRET = 'whsec_test_secret_key';

function generateSignature(payload: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const sig = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${ts},v1=${sig}`;
}

describe('verifyStripeSignature', () => {
  it('valid signature passes verification', () => {
    const payload = '{"type":"test"}';
    const sig = generateSignature(payload, WEBHOOK_SECRET);
    expect(verifyStripeSignature(payload, sig, WEBHOOK_SECRET)).toBe(true);
  });

  it('tampered payload fails verification', () => {
    const payload = '{"type":"test"}';
    const sig = generateSignature(payload, WEBHOOK_SECRET);
    expect(verifyStripeSignature('{"type":"tampered"}', sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('expired timestamp is rejected', () => {
    const payload = '{"type":"test"}';
    const oldTs = Math.floor(Date.now() / 1000) - STRIPE_TOLERANCE_SECONDS - 60;
    const sig = generateSignature(payload, WEBHOOK_SECRET, oldTs);
    expect(verifyStripeSignature(payload, sig, WEBHOOK_SECRET)).toBe(false);
  });
});

describe('POST /webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('unknown event types return 200 without error', async () => {
    const payload = JSON.stringify({ type: 'customer.created', data: { object: {} } });
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean };
    expect(body.received).toBe(true);
  });

  it('checkout.session.completed without client_reference_id is ignored gracefully', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123', amount_total: 1000 } },
    });
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    });

    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('checkout.session.completed creates conversion when click matches', async () => {
    const visitorId = 'visitor-abc';
    const partnerId = 'partner-xyz';
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_456',
          client_reference_id: visitorId,
          amount_total: 5000,
          metadata: { plan_id: 'pro' },
        },
      },
    });
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    // Mock click lookup
    setupSelectChain([{ partnerId, visitorId, eventType: 'click', createdAt: new Date() }]);
    // Mock commission rule lookup (second select call)
    const origFrom = mockFrom.getMockImplementation();
    mockFrom.mockImplementation(function(this: any) {
      if (mockFrom.mock.calls.length <= 1) {
        return origFrom?.apply(this, arguments as any);
      }
      return { where: mockWhere };
    });
    mockWhere.mockImplementation(function(this: any) {
      if (mockWhere.mock.calls.length <= 1) {
        return { orderBy: mockOrderBy };
      }
      return { limit: mockLimit };
    });
    mockLimit.mockImplementation(async function(this: any) {
      if (mockLimit.mock.calls.length <= 1) {
        return [{ partnerId, visitorId, eventType: 'click', createdAt: new Date() }];
      }
      return [{ planId: 'pro', type: 'percent', value: '10.0000', active: true }];
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    });

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('invoice.paid creates recurring commission linked to original conversion', async () => {
    const payload = JSON.stringify({
      type: 'invoice.paid',
      data: {
        object: {
          subscription: 'sub_789',
          amount_paid: 5000,
        },
      },
    });
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    // First select: find original conversion
    // Second select: commission rules
    let callCount = 0;
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return [{ partnerId: 'partner-xyz', planId: 'pro', stripeCheckoutSessionId: 'sub_789' }];
      }
      return [{ planId: 'pro', type: 'fixed', value: '500.0000', active: true }];
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': sig, 'content-type': 'application/json' },
      body: payload,
    });

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('invalid signature returns 400', async () => {
    const payload = JSON.stringify({ type: 'test' });
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=badsig', 'content-type': 'application/json' },
      body: payload,
    });
    expect(res.status).toBe(400);
  });
});
