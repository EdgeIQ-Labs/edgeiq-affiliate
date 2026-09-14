import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { tracking } from './tracking.js';
import { buildCheckoutUrl } from '@relay/core/checkout';

// Mock the database module
vi.mock('@relay/core/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@relay/core/db';

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

const approvedPartner = {
  id: 'partner-uuid-123',
  email: 'test@example.com',
  name: 'Test Partner',
  referralCode: 'VALIDCODE',
  status: 'approved' as const,
  createdAt: new Date(),
};

const suspendedPartner = {
  ...approvedPartner,
  id: 'partner-uuid-456',
  referralCode: 'SUSPENDED',
  status: 'suspended' as const,
};

describe('Tracking Engine', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEFAULT_CHECKOUT_URL = 'https://buy.stripe.com/test_link';
    delete process.env.COOKIE_DOMAIN;

    app = new Hono();
    app.route('/', tracking);

    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  describe('GET /r/:code', () => {
    it('redirects with correct cookie and URL for valid referral code', async () => {
      // Mock DB chain: select().from().where().limit()
      const limitFn = vi.fn().mockResolvedValue([approvedPartner]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      // Mock insert chain
      const valuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesFn });

      const res = await app.request('/r/VALIDCODE', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'TestAgent/1.0',
          referer: 'https://example.com',
        },
      });

      expect(res.status).toBe(302);

      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      expect(location!.startsWith('https://buy.stripe.com/test_link?client_reference_id=')).toBe(true);

      // Extract visitor ID from redirect URL
      const url = new URL(location!);
      const visitorId = url.searchParams.get('client_reference_id');
      expect(visitorId).toBeTruthy();
      expect(visitorId!.length).toBe(36); // UUID length

      // Verify cookie
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain(`_relay_vid=${visitorId}`);
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Max-Age=2592000');
      expect(setCookie).toContain('SameSite=Lax');

      // Verify DB insert was called with correct event type
      expect(valuesFn).toHaveBeenCalled();
      const insertedValues = valuesFn.mock.calls[0][0];
      expect(insertedValues.eventType).toBe('click');
      expect(insertedValues.partnerId).toBe('partner-uuid-123');
      expect(insertedValues.visitorId).toBe(visitorId);
      expect(insertedValues.metadata.ip).toBe('1.2.3.4');
      expect(insertedValues.metadata.userAgent).toBe('TestAgent/1.0');
    });

    it('returns 404 for invalid referral code', async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      const res = await app.request('/r/INVALIDCODE');

      expect(res.status).toBe(404);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('returns 404 for suspended partner', async () => {
      const limitFn = vi.fn().mockResolvedValue([suspendedPartner]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      const res = await app.request('/r/SUSPENDED');

      expect(res.status).toBe(404);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('returns 500 when DEFAULT_CHECKOUT_URL is not configured', async () => {
      delete process.env.DEFAULT_CHECKOUT_URL;

      const limitFn = vi.fn().mockResolvedValue([approvedPartner]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      const valuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesFn });

      const res = await app.request('/r/VALIDCODE');

      expect(res.status).toBe(500);
    });

    it('includes COOKIE_DOMAIN in cookie when configured', async () => {
      process.env.COOKIE_DOMAIN = '.example.com';

      const limitFn = vi.fn().mockResolvedValue([approvedPartner]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      const valuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesFn });

      const res = await app.request('/r/VALIDCODE');

      expect(res.status).toBe(302);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('Domain=.example.com');
    });

    it('extracts IP from x-real-ip when x-forwarded-for is absent', async () => {
      const limitFn = vi.fn().mockResolvedValue([approvedPartner]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });

      const valuesFn = vi.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesFn });

      await app.request('/r/VALIDCODE', {
        headers: { 'x-real-ip': '5.6.7.8' },
      });

      const insertedValues = valuesFn.mock.calls[0][0];
      expect(insertedValues.metadata.ip).toBe('5.6.7.8');
    });
  });
});

describe('buildCheckoutUrl', () => {
  it('appends client_reference_id to URL without query params', () => {
    const result = buildCheckoutUrl('https://buy.stripe.com/abc123', 'visitor-1');
    expect(result).toBe('https://buy.stripe.com/abc123?client_reference_id=visitor-1');
  });

  it('appends client_reference_id to URL with existing query params', () => {
    const result = buildCheckoutUrl('https://buy.stripe.com/abc123?mode=subscription', 'visitor-2');
    expect(result).toBe('https://buy.stripe.com/abc123?mode=subscription&client_reference_id=visitor-2');
  });

  it('throws on invalid URL', () => {
    expect(() => buildCheckoutUrl('not-a-url', 'visitor-3')).toThrow('Invalid checkout URL');
  });

  it('works with custom checkout URLs', () => {
    const result = buildCheckoutUrl('https://myapp.com/checkout?plan=pro', 'visitor-4');
    expect(result).toBe('https://myapp.com/checkout?plan=pro&client_reference_id=visitor-4');
  });
});
