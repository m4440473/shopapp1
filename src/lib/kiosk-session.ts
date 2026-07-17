import { createHmac, timingSafeEqual } from 'crypto';

export const KIOSK_SESSION_COOKIE = 'shopapp_kiosk_session';

function getKioskSessionSecret() {
  const configured = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for kiosk sessions.');
  }
  return 'shopapp-kiosk-dev-secret';
}

function signValue(value: string) {
  return createHmac('sha256', getKioskSessionSecret()).update(value).digest('hex');
}

export function createKioskSessionValue(userId: string) {
  const payload = `${String(userId || '').trim()}:${Date.now()}`;
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
  const timestampSeparator = payload.lastIndexOf(':');
  if (timestampSeparator <= 0) return null;
  const userId = payload.slice(0, timestampSeparator);
  const issuedAt = Number(payload.slice(timestampSeparator + 1));
  if (!userId || !Number.isFinite(issuedAt)) return null;
  const maxAgeMs = kioskSessionCookieOptions.maxAge * 1000;
  if (issuedAt > Date.now() + 60_000 || Date.now() - issuedAt > maxAgeMs) return null;
  return userId;
}

export const kioskSessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 12,
};
