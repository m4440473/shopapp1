import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { logPartEvent } from '@/modules/orders/orders.service';
import { pauseActiveTimeEntry } from '@/modules/time/time.service';

export async function POST() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const result = await pauseActiveTimeEntry(userId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const entry = result.data.entry;
  if (entry.partId) {
    await logPartEvent({
      orderId: entry.orderId,
      partId: entry.partId,
      userId,
      type: 'TIMER_PAUSED',
      message: 'Timer paused.',
      meta: { timeEntryId: entry.id },
    });
  }

  return NextResponse.json({ entry });
}
