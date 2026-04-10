import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { authRequiredResponse } from '@/lib/auth-api';

import {
  getDepartmentsOrdered,
  getOrderHeaderInfo,
  getOrderPartSummary,
  logPartEvent,
  requirePartInstructionAcknowledgement,
  syncOrderWorkflowStatus,
} from '@/modules/orders/orders.service';
import { TimeEntryStart } from '@/modules/time/time.schema';
import { getActiveTimeEntries, getActiveTimeEntry, startTimeEntryWithConflict } from '@/modules/time/time.service';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return authRequiredResponse();

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return authRequiredResponse();

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryStart.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, partId, departmentId } = parsed.data;
  if (!partId) {
    return NextResponse.json({ error: 'partId is required for timer start.' }, { status: 400 });
  }

  const departmentsResult = await getDepartmentsOrdered();
  if (departmentsResult.ok === false) {
    return NextResponse.json({ error: departmentsResult.error }, { status: departmentsResult.status });
  }
  const selectedDepartment = departmentsResult.data.items.find((department) => department.id === departmentId);
  if (!selectedDepartment) {
    return NextResponse.json({ error: 'Department not found.' }, { status: 400 });
  }
  if (selectedDepartment.name.trim().toLowerCase() === 'shipping') {
    return NextResponse.json({ error: 'Shipping timers are disabled.' }, { status: 400 });
  }

  const partCheck = await getOrderPartSummary(orderId, partId);
  if (partCheck.ok === false) {
    return NextResponse.json({ error: partCheck.error }, { status: partCheck.status });
  }

  const ackResult = await requirePartInstructionAcknowledgement({
    orderId,
    partId,
    userId,
    departmentId,
  });
  if (ackResult.ok === false) {
    return NextResponse.json({ error: ackResult.error }, { status: ackResult.status });
  }

  const result = await startTimeEntryWithConflict(userId, {
    orderId,
    partId,
    departmentId,
    operation: 'Part Work',
  });
  if (result.ok === false) {
    if (result.status === 409) {
      const activeEntriesResult = await getActiveTimeEntries(userId);
      if (activeEntriesResult.ok === false) {
        return NextResponse.json({ error: activeEntriesResult.error }, { status: activeEntriesResult.status });
      }
      const matchingDepartmentEntry =
        activeEntriesResult.data.entries.find((entry) => entry.departmentId === departmentId) ?? null;
      const activeResult = matchingDepartmentEntry
        ? ({ ok: true, data: { entry: matchingDepartmentEntry } } as const)
        : await getActiveTimeEntry(userId);
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

      const activeOrder = activeOrderResult?.ok ? (activeOrderResult.data as { order: any }).order : null;
      const activePart = activePartResult?.ok ? (activePartResult.data as { part: any }).part : null;
      const activeOrderHref = activeOrder?.id ? `/orders/${activeOrder.id}` : activeEntry ? `/orders/${activeEntry.orderId}` : null;

      if (!activeEntry) {
        return NextResponse.json(
          {
            error: 'Timer state is out of sync. Refresh and try again.',
            requiredAction: 'refresh',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: result.error,
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
  await syncOrderWorkflowStatus(orderId, { userId });

  return NextResponse.json({ entry });
}
