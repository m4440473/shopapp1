import { NextResponse } from 'next/server';
import { getKioskSessionUserId } from '@/app/api/kiosk/_lib';
import { finishKioskTimer } from '@/modules/kiosk/kiosk.service';

export async function POST(req: Request) {
  const userId = getKioskSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk locked.' }, { status: 401 });
  }

  const result = await finishKioskTimer(userId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
