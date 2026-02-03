import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderPartSummary, logPartEvent } from '@/modules/orders/orders.service';
import { startTimeEntry } from '@/modules/time/time.service';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const orderId = typeof json?.orderId === 'string' ? json.orderId : '';
  const partId = typeof json?.partId === 'string' ? json.partId : '';
  if (!orderId || !partId) {
    return NextResponse.json({ error: 'Missing orderId or partId' }, { status: 400 });
  }

  const partCheck = await getOrderPartSummary(orderId, partId);
  if (partCheck.ok === false) {
    return NextResponse.json({ error: partCheck.error }, { status: partCheck.status });
  }

  const result = await startTimeEntry(userId, {
    orderId,
    partId,
    operation: 'Part Work',
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const entry = result.data.entry;
  await logPartEvent({
    orderId,
    partId,
    userId,
    type: 'TIMER_STARTED',
    message: 'Timer started.',
    meta: { timeEntryId: entry.id },
  });

  return NextResponse.json({ entry });
}
