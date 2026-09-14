import { randomUUID } from 'node:crypto';

export const COOKIE_NAME = '_relay_vid';
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function generateVisitorId(): string {
  return randomUUID();
}

export function parseVisitorCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === COOKIE_NAME) {
      return rest.join('=') || null;
    }
  }
  return null;
}
