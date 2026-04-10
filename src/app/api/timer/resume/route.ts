import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { logPartEvent, requirePartInstructionAcknowledgement, syncOrderWorkflowStatus } from '@/modules/orders/orders.service';
import { TimeEntryResume } from '@/modules/time/time.schema';
import { getTimeEntryDetails, resumeTimeEntry } from '@/modules/time/time.service';

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

  const entryResult = await getTimeEntryDetails(userId, parsed.data.entryId);
  if (entryResult.ok === false) {
    return NextResponse.json({ error: entryResult.error }, { status: entryResult.status });
  }

  const priorEntry = entryResult.data.entry;
  if (priorEntry.partId && priorEntry.departmentId) {
    const ackResult = await requirePartInstructionAcknowledgement({
      orderId: priorEntry.orderId,
      partId: priorEntry.partId,
      userId,
      departmentId: priorEntry.departmentId,
    });
    if (ackResult.ok === false) {
      return NextResponse.json({ error: ackResult.error }, { status: ackResult.status });
    }
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
