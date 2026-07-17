import { NextResponse } from 'next/server';

import { getKioskSessionUserId } from '@/app/api/kiosk/_lib';
import { acknowledgePartInstructions } from '@/modules/orders/orders.service';

export async function POST(req: Request) {
  const userId = getKioskSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk locked.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  const partId = typeof body?.partId === 'string' ? body.partId.trim() : '';
  const departmentId = typeof body?.departmentId === 'string' ? body.departmentId.trim() : '';
  if (!orderId || !partId || !departmentId) {
    return NextResponse.json(
      { error: 'orderId, partId, and departmentId are required.' },
      { status: 400 },
    );
  }

  const result = await acknowledgePartInstructions({
    orderId,
    partId,
    departmentId,
    userId,
    actorUserId: userId,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
