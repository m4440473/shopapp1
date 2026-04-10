import { NextResponse } from 'next/server';
import { createKioskSessionValue, kioskSessionCookieOptions, KIOSK_SESSION_COOKIE } from '@/lib/kiosk-session';
import { KioskUnlockInput } from '@/modules/kiosk/kiosk.schema';
import { getKioskSessionContext, unlockKioskByPin, unlockKioskByWorkerPin } from '@/modules/kiosk/kiosk.service';

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = KioskUnlockInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const unlockResult = parsed.data.userId
    ? await unlockKioskByWorkerPin({ userId: parsed.data.userId, pin: parsed.data.pin })
    : await unlockKioskByPin(parsed.data.pin);
  if (unlockResult.ok === false) {
    return NextResponse.json({ error: unlockResult.error }, { status: unlockResult.status });
  }

  const workerId = String((unlockResult.data.worker as any).id ?? '');
  const contextResult = await getKioskSessionContext(workerId);
  if (contextResult.ok === false) {
    return NextResponse.json({ error: contextResult.error }, { status: contextResult.status });
  }

  const response = NextResponse.json(contextResult.data);
  response.cookies.set(KIOSK_SESSION_COOKIE, createKioskSessionValue(workerId), kioskSessionCookieOptions);
  return response;
}
