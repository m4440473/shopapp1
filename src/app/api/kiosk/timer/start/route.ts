import { NextResponse } from 'next/server';
import { getKioskSessionUserId } from '@/app/api/kiosk/_lib';
import { KioskTimerStartInput } from '@/modules/kiosk/kiosk.schema';
import { startKioskTimer } from '@/modules/kiosk/kiosk.service';

export async function POST(req: Request) {
  const userId = getKioskSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk locked.' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = KioskTimerStartInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await startKioskTimer({ userId, ...parsed.data });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
