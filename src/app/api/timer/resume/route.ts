import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { logPartEvent, syncOrderWorkflowStatus } from '@/modules/orders/orders.service';
import { TimeEntryResume } from '@/modules/time/time.schema';
import { resumeTimeEntry } from '@/modules/time/time.service';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryResume.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await resumeTimeEntry(userId, parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const entry = result.data.entry;
  if (entry.partId) {
    await logPartEvent({
      orderId: entry.orderId,
      partId: entry.partId,
      userId,
      type: 'TIMER_STARTED',
      message: 'Timer resumed.',
      meta: { timeEntryId: entry.id, resumedFromEntryId: parsed.data.entryId },
    });
    await syncOrderWorkflowStatus(entry.orderId, { userId });
  }

  return NextResponse.json({ entry });
}
