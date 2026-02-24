import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderHeaderInfo, getOrderPartSummary, logPartEvent } from '@/modules/orders/orders.service';
import { TimeEntryResume } from '@/modules/time/time.schema';
import { getActiveTimeEntry, resumeTimeEntry } from '@/modules/time/time.service';

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

  const activeResult = await getActiveTimeEntry(userId);
  if (activeResult.ok === false) {
    return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
  }

  if (activeResult.data.entry) {
    const activeEntry = activeResult.data.entry;
    const activeOrderResult = await getOrderHeaderInfo(activeEntry.orderId);
    const activePartResult = activeEntry.partId
      ? await getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
      : null;
    const activeOrder = activeOrderResult?.ok ? (activeOrderResult.data as { order: any }).order : null;
    const activePart = activePartResult?.ok ? (activePartResult.data as { part: any }).part : null;
    const activeOrderHref = activeOrder?.id ? `/orders/${activeOrder.id}` : `/orders/${activeEntry.orderId}`;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000));

    return NextResponse.json(
      {
        error: 'Active time entry already running.',
        requiredAction: 'switch_confirmation',
        switchAction: 'pause_or_finish',
        activeEntry,
        activeOrder,
        activePart,
        activeOrderHref,
        elapsedSeconds,
      },
      { status: 409 }
    );
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
  }

  return NextResponse.json({ entry });
}
