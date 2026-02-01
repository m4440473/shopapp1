import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { completeOrderPart, logPartEvent } from '@/modules/orders/orders.service';
import { getActiveTimeEntry, stopActiveTimeEntry } from '@/modules/time/time.service';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const activeResult = await getActiveTimeEntry(userId);
  if (activeResult.ok === false) {
    return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
  }

  const activeEntry = activeResult.data.entry;
  if (!activeEntry) {
    return NextResponse.json({ error: 'No active timer to finish.' }, { status: 404 });
  }

  if (!activeEntry.partId) {
    return NextResponse.json({ error: 'Active timer is not tied to a part.' }, { status: 400 });
  }

  const stopResult = await stopActiveTimeEntry(userId);
  if (stopResult.ok === false) {
    return NextResponse.json({ error: stopResult.error }, { status: stopResult.status });
  }

  const entry = stopResult.data.entry;
  await logPartEvent({
    orderId: entry.orderId,
    partId: entry.partId!,
    userId,
    type: 'TIMER_FINISHED',
    message: 'Timer finished.',
    meta: { timeEntryId: entry.id },
  });

  const completeResult = await completeOrderPart({
    orderId: entry.orderId,
    partId: entry.partId!,
    userId,
  });

  if (completeResult.ok === false) {
    return NextResponse.json({ error: completeResult.error }, { status: completeResult.status });
  }

  return NextResponse.json({ entry, part: completeResult.data.part });
}
