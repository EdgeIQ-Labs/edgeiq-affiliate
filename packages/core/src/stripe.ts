import { createHmac, timingSafeEqual } from 'node:crypto';

export const STRIPE_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  let timestamp: string | null = null;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) {
      timestamp = trimmed.slice(2);
    } else if (trimmed.startsWith('v1=')) {
      v1Signatures.push(trimmed.slice(3));
    }
  }

  if (!timestamp || v1Signatures.length === 0) {
    return false;
  }

  const ts = Number(timestamp);
  if (Number.isNaN(ts)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > STRIPE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  for (const sig of v1Signatures) {
    const sigBuf = Buffer.from(sig, 'hex');
    if (sigBuf.length !== expectedBuf.length) {
      continue;
    }
    if (timingSafeEqual(expectedBuf, sigBuf)) {
      return true;
    }
  }

  return false;
}
