import {
  assignWorkerToPart,
  getDepartmentsOrdered,
  getOrderHeaderInfo,
  getOrderPartSummary,
  logPartEvent,
  requirePartInstructionAcknowledgement,
  syncOrderWorkflowStatus,
} from '@/modules/orders/orders.service';
import { findUserById } from '@/repos/users';
import {
  closeWorkerTimer,
  getActiveTimeEntry,
  startWorkerTimer,
  switchWorkerTimer,
} from './time.service';

type DispatchError =
  | string
  | {
      message: string;
      requiredAction: 'switch_confirmation' | 'instruction_confirmation';
      activeEntry?: unknown;
      activeOrder?: unknown;
      activePart?: unknown;
      elapsedSeconds?: number;
    };

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: DispatchError };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: DispatchError): ServiceResult<T> {
  return { ok: false, status, error };
}

type PreparedTarget = {
  worker: {
    id: string;
    name: string | null;
    email: string;
  };
  part: {
    id: string;
    partNumber: string;
    status: string;
    currentDepartmentId: string | null;
    workInstructions: string | null;
    instructionsVersion: number;
  };
  departmentId: string;
};

async function prepareTarget({
  orderId,
  partId,
  workerUserId,
}: {
  orderId: string;
  partId: string;
  workerUserId: string;
}): Promise<ServiceResult<PreparedTarget>> {
  const [worker, partResult, departmentsResult] = await Promise.all([
    findUserById(workerUserId),
    getOrderPartSummary(orderId, partId),
    getDepartmentsOrdered(),
  ]);

  if (!worker || worker.active === false || worker.role === 'VIEWER') {
    return fail(404, 'Active employee not found.');
  }
  if (partResult.ok === false) return fail(partResult.status, String(partResult.error));
  if (departmentsResult.ok === false) return fail(departmentsResult.status, String(departmentsResult.error));

  const part = (partResult.data as { part: PreparedTarget['part'] }).part;
  if (part.status === 'COMPLETE') {
    return fail(409, 'Completed parts cannot start new production timers.');
  }
  const departmentId = part.currentDepartmentId;
  if (!departmentId) {
    return fail(409, 'This part has no current department. Assign it before starting work.');
  }
  const department = departmentsResult.data.items.find((item) => item.id === departmentId);
  if (!department) return fail(409, 'This part belongs to an inactive or missing department.');
  if (department.name.trim().toLowerCase() === 'shipping') {
    return fail(409, 'Shipping does not use production timers.');
  }

  const acknowledgement = await requirePartInstructionAcknowledgement({
    orderId,
    partId,
    userId: workerUserId,
    departmentId,
  });
  if (acknowledgement.ok === false) {
    return fail(409, {
      message: `${worker.name ?? worker.email} must read and acknowledge the part instructions before work starts.`,
      requiredAction: 'instruction_confirmation',
    });
  }

  return ok({ worker, part, departmentId });
}

export async function startDispatchTimer({
  actorUserId,
  workerUserId,
  orderId,
  partId,
  confirmSwitch = false,
}: {
  actorUserId: string;
  workerUserId: string;
  orderId: string;
  partId: string;
  confirmSwitch?: boolean;
}): Promise<ServiceResult<{ entry: any; previousEntry: any | null }>> {
  const targetResult = await prepareTarget({
    workerUserId,
    orderId,
    partId,
  });
  if (targetResult.ok === false) return targetResult;

  const activeResult = await getActiveTimeEntry(workerUserId);
  if (activeResult.ok === false) return fail(activeResult.status, activeResult.error);
  const activeEntry = activeResult.data.entry;

  if (activeEntry && activeEntry.orderId === orderId && activeEntry.partId === partId) {
    return fail(409, 'That employee is already running on this part.');
  }

  if (activeEntry && !confirmSwitch) {
    const [activeOrderResult, activePartResult] = await Promise.all([
      getOrderHeaderInfo(activeEntry.orderId),
      activeEntry.partId
        ? getOrderPartSummary(activeEntry.orderId, activeEntry.partId)
        : Promise.resolve(null),
    ]);
    return fail(409, {
      message: 'That employee already has a running timer.',
      requiredAction: 'switch_confirmation',
      activeEntry,
      activeOrder: activeOrderResult.ok
        ? (activeOrderResult.data as { order: unknown }).order
        : null,
      activePart: activePartResult?.ok
        ? (activePartResult.data as { part: unknown }).part
        : null,
      elapsedSeconds: Math.max(
        0,
        Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000),
      ),
    });
  }

  const timerResult = activeEntry
    ? await switchWorkerTimer(actorUserId, workerUserId, {
        orderId,
        partId,
        departmentId: targetResult.data.departmentId,
      })
    : await startWorkerTimer(actorUserId, workerUserId, {
        orderId,
        partId,
        departmentId: targetResult.data.departmentId,
      });
  if (timerResult.ok === false) return fail(timerResult.status, timerResult.error);

  await assignWorkerToPart({
    orderId,
    partId,
    userId: workerUserId,
    assignedById: actorUserId,
  });

  const previousEntry =
    'previousEntry' in timerResult.data
      ? (timerResult.data.previousEntry as {
          id: string;
          orderId: string;
          partId: string | null;
        } | null)
      : null;
  if (previousEntry?.partId) {
    const previous = previousEntry;
    await logPartEvent({
      orderId: previous.orderId,
      partId: previous.partId,
      userId: actorUserId,
      type: 'TIMER_PAUSED',
      message: `${targetResult.data.worker.name ?? targetResult.data.worker.email}'s timer paused for urgent work.`,
      meta: {
        timeEntryId: previous.id,
        workerUserId,
        transitionSource: 'dispatch_console_switch',
        switchedToOrderId: orderId,
        switchedToPartId: partId,
      },
    });
  }

  const entry = timerResult.data.entry;
  await logPartEvent({
    orderId,
    partId,
    userId: actorUserId,
    type: activeEntry ? 'TIMER_SWITCHED' : 'TIMER_STARTED',
    message: `${targetResult.data.worker.name ?? targetResult.data.worker.email}'s timer ${activeEntry ? 'switched to' : 'started on'} this part.`,
    meta: {
      timeEntryId: entry.id,
      workerUserId,
      transitionSource: 'dispatch_console',
    },
  });
  await syncOrderWorkflowStatus(orderId, { userId: actorUserId });
  return ok({ entry, previousEntry });
}

export async function closeDispatchTimer({
  actorUserId,
  workerUserId,
  entryId,
  action,
  reason,
}: {
  actorUserId: string;
  workerUserId: string;
  entryId?: string | null;
  action: 'PAUSE' | 'FINISH' | 'ADMIN_CLOSE';
  reason?: string | null;
}) {
  if (action === 'ADMIN_CLOSE' && (!reason || reason.trim().length < 5)) {
    return fail(400, 'A reason is required when closing a stale timer.');
  }

  const worker = await findUserById(workerUserId);
  if (!worker) return fail(404, 'Employee not found.');

  const result = await closeWorkerTimer(actorUserId, workerUserId, {
    entryId,
    action,
    reason: reason?.trim() || null,
  });
  if (result.ok === false) return result;

  const entry = result.data.entry;
  if (entry.partId) {
    await logPartEvent({
      orderId: entry.orderId,
      partId: entry.partId,
      userId: actorUserId,
      type: action === 'PAUSE' ? 'TIMER_PAUSED' : 'TIMER_FINISHED',
      message: `${worker.name ?? worker.email}'s timer ${action === 'PAUSE' ? 'paused' : 'finished'} from the dispatch console.`,
      meta: {
        timeEntryId: entry.id,
        workerUserId,
        transitionSource: 'dispatch_console',
        reason: reason?.trim() || null,
      },
    });
    if (action !== 'PAUSE') {
      await syncOrderWorkflowStatus(entry.orderId, { userId: actorUserId });
    }
  }
  return ok({ entry });
}
