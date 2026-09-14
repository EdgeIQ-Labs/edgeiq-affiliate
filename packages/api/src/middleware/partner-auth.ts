import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';

const ALGORITHM = 'sha256';

function getSecret(): string {
  return process.env.PARTNER_SECRET || 'change-me-partner-secret';
}

export function generatePartnerToken(partnerId: string): string {
  const secret = getSecret();
  const hmac = crypto.createHmac(ALGORITHM, secret).update(partnerId).digest('hex');
  const payload = `${partnerId}.${hmac}`;
  return Buffer.from(payload).toString('base64url');
}

export function verifyPartnerToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const dotIndex = decoded.lastIndexOf('.');
    if (dotIndex === -1) return null;
    const partnerId = decoded.slice(0, dotIndex);
    const providedHmac = decoded.slice(dotIndex + 1);
    const secret = getSecret();
    const expectedHmac = crypto.createHmac(ALGORITHM, secret).update(partnerId).digest('hex');
    const a = Buffer.from(providedHmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    return partnerId;
  } catch {
    return null;
  }
}

export type PartnerEnv = {
  Variables: {
    partnerId: string;
  };
};

export const partnerAuth = createMiddleware<PartnerEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const partnerId = verifyPartnerToken(token);

  if (!partnerId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('partnerId', partnerId);
  await next();
});
