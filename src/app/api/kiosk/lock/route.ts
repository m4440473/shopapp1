import { NextResponse } from 'next/server';
import { KIOSK_SESSION_COOKIE } from '@/lib/kiosk-session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(KIOSK_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
