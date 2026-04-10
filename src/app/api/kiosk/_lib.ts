import { readKioskSessionUserId, KIOSK_SESSION_COOKIE } from '@/lib/kiosk-session';

export function getKioskSessionUserId(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const rawCookie = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${KIOSK_SESSION_COOKIE}=`))
    ?.slice(KIOSK_SESSION_COOKIE.length + 1);
  return readKioskSessionUserId(rawCookie);
}
