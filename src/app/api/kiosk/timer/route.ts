import { NextRequest, NextResponse } from 'next/server';
import { KIOSK_SESSION_COOKIE, readKioskSessionUserId } from '@/lib/kiosk-session';
import { KioskTimerStart } from '@/modules/kiosk/kiosk.schema';
import {
  finishKioskWorkerTimer,
  getKioskWorkerSession,
  pauseKioskWorkerTimer,
  startKioskWorkerTimer,
} from '@/modules/kiosk/kiosk.service';

function readUserId(req: NextRequest) {
  return readKioskSessionUserId(req.cookies.get(KIOSK_SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const userId = readUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk is locked.' }, { status: 401 });
  }

  const result = await getKioskWorkerSession(userId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const userId = readUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk is locked.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : 'start';

  if (action === 'pause') {
    const result = await pauseKioskWorkerTimer(userId);
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }

  if (action === 'finish') {
    const result = await finishKioskWorkerTimer(userId);
    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }

  const parsed = KioskTimerStart.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await startKioskWorkerTimer({
    userId,
    orderId: parsed.data.orderId,
    partId: parsed.data.partId,
    departmentId: parsed.data.departmentId,
    switchAction: parsed.data.switchAction,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
