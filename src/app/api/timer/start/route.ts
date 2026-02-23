import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderHeaderInfo, getOrderPartSummary, logPartEvent } from '@/modules/orders/orders.service';
import { TimeEntryStart } from '@/modules/time/time.schema';
import { getActiveTimeEntry, startTimeEntryWithConflict } from '@/modules/time/time.service';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryStart.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, partId } = parsed.data;
  if (!partId) {
    return NextResponse.json({ error: 'partId is required for timer start.' }, { status: 400 });
  }

  const partCheck = await getOrderPartSummary(orderId, partId);
  if (partCheck.ok === false) {
    return NextResponse.json({ error: partCheck.error }, { status: partCheck.status });
  }

  const result = await startTimeEntryWithConflict(userId, {
    orderId,
    partId,
    operation: 'Part Work',
  });
  if (result.ok === false) {
    if (result.status === 409) {
      const activeResult = await getActiveTimeEntry(userId);
      if (activeResult.ok === false) {
        return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
      }

      const activeEntry = activeResult.data.entry;
      const activeOrderResult = activeEntry ? await getOrderHeaderInfo(activeEntry.orderId) : null;
      const activePartResult = activeEntry?.partId
        ? await getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
        : null;
      const elapsedSeconds = activeEntry
        ? Math.max(0, Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000))
        : 0;

      return NextResponse.json(
        {
          error: result.error,
          requiredAction: 'switch_confirmation',
          switchAction: 'pause_or_finish',
          activeEntry,
          activeOrder: activeOrderResult?.ok ? (activeOrderResult.data as { order: unknown }).order : null,
          activePart: activePartResult?.ok ? (activePartResult.data as { part: unknown }).part : null,
          elapsedSeconds,
        },
        { status: 409 }
      );
    }

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
