import { createHmac, timingSafeEqual } from 'crypto';

export const KIOSK_SESSION_COOKIE = 'shopapp_kiosk_session';

function getKioskSessionSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'shopapp-kiosk-dev-secret';
}

function signValue(value: string) {
  return createHmac('sha256', getKioskSessionSecret()).update(value).digest('hex');
}

export function createKioskSessionValue(userId: string) {
  const payload = String(userId || '').trim();
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

export function readKioskSessionUserId(rawCookieValue?: string | null) {
  if (!rawCookieValue) return null;
  const separator = rawCookieValue.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = rawCookieValue.slice(0, separator);
  const signature = rawCookieValue.slice(separator + 1);
  const expected = signValue(payload);
  const left = Buffer.from(signature, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;
  return payload || null;
}

export const kioskSessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 12,
};
