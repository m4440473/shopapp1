import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { getOrderHeaderInfo, getOrderPartSummary, logPartEvent } from '@/modules/orders/orders.service';
import { getActiveTimeEntry, startTimeEntryWithConflict } from '@/modules/time/time.service';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
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

  const activeResult = await getActiveTimeEntry(userId);
  if (activeResult.ok === false) {
    return NextResponse.json({ error: activeResult.error }, { status: activeResult.status });
  }

  const activeEntry = activeResult.data.entry;
  if (activeEntry) {
    const orderResult = await getOrderHeaderInfo(activeEntry.orderId);
    const partResult = activeEntry.partId
      ? await getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
      : null;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000));
    return NextResponse.json(
      {
        error: 'Active timer already running.',
        activeEntry,
        activeOrder: orderResult.ok ? orderResult.data.order : null,
        activePart: partResult?.ok ? partResult.data.part : null,
        elapsedSeconds,
      },
      { status: 409 }
    );
  }

  const result = await startTimeEntryWithConflict(userId, {
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
