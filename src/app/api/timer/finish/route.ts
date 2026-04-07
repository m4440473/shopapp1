import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { logPartEvent, syncOrderWorkflowStatus } from '@/modules/orders/orders.service';
import { stopActiveTimeEntry, stopTimeEntryById } from '@/modules/time/time.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  const entryId = typeof body?.entryId === 'string' ? body.entryId.trim() : '';
  const stopResult = entryId ? await stopTimeEntryById(userId, entryId) : await stopActiveTimeEntry(userId);
  if (stopResult.ok === false) {
    return NextResponse.json({ error: stopResult.error }, { status: stopResult.status });
  }

  const entry = stopResult.data.entry;
  if (!entry.partId) {
    return NextResponse.json({ error: 'Active timer is not tied to a part.' }, { status: 400 });
  }
  await logPartEvent({
    orderId: entry.orderId,
    partId: entry.partId!,
    userId,
    type: 'TIMER_FINISHED',
    message: 'Timer finished.',
    meta: { timeEntryId: entry.id },
  });
  await syncOrderWorkflowStatus(entry.orderId, { userId });

  return NextResponse.json({ entry });
}
