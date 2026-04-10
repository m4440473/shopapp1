import 'server-only';

import { compare } from 'bcryptjs';
import { searchKioskPartsForDepartment } from '@/repos/orders';
import { findUserByKioskId, listKioskUsers } from '@/repos/users';
import {
  getDepartmentsOrdered,
  getOrderHeaderInfo,
  getOrderPartSummary,
  logPartEvent,
  requirePartInstructionAcknowledgement,
  syncOrderWorkflowStatus,
} from '@/modules/orders/orders.service';
import {
  getActiveTimeEntry,
  pauseActiveTimeEntry,
  startTimeEntry,
  stopActiveTimeEntry,
} from '@/modules/time/time.service';

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

function sanitizeWorker(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.role ?? null,
    kioskEnabled: Boolean(user.kioskEnabled),
    active: user.active !== false,
    primaryDepartmentId: user.primaryDepartmentId ?? null,
    primaryDepartment: user.primaryDepartment ?? null,
  };
}

async function resolveKioskWorker(userId: string) {
  const user = await findUserByKioskId(userId);
  if (!user || user.active === false) {
    return null;
  }
  return user;
}

async function buildActiveTimerContext(userId: string) {
  const activeResult = await getActiveTimeEntry(userId);
  if (activeResult.ok === false) return activeResult;

  const activeEntry = activeResult.data.entry;
  if (!activeEntry) {
    return ok({
      activeEntry: null,
      activeOrder: null,
      activePart: null,
      elapsedSeconds: 0,
    });
  }

  const [orderResult, partResult] = await Promise.all([
    getOrderHeaderInfo(activeEntry.orderId),
    activeEntry.partId ? getOrderPartSummary(activeEntry.orderId, activeEntry.partId) : Promise.resolve(null),
  ]);

  return ok({
    activeEntry,
    activeOrder: orderResult.ok ? orderResult.data.order : null,
    activePart: partResult?.ok ? partResult.data.part : null,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - activeEntry.startedAt.getTime()) / 1000)),
  });
}

export async function authenticateKioskWorker(pin: string, userId?: string) {
  if (userId) {
    const worker = await findUserByKioskId(userId);
    if (!worker || worker.active === false) {
      return fail(401, 'Invalid worker or PIN.');
    }
    if (!worker.kioskPinHash) {
      return fail(403, 'Selected worker does not have a kiosk PIN yet.');
    }
    const matches = await compare(pin, worker.kioskPinHash);
    if (!matches) {
      return fail(401, 'Invalid worker or PIN.');
    }
    return ok({ worker: sanitizeWorker(worker) });
  }

  const workers = await listKioskUsers();
  for (const worker of workers) {
    if (!worker.kioskPinHash) continue;
    if (await compare(pin, worker.kioskPinHash)) {
      return ok({ worker: sanitizeWorker(worker) });
    }
  }

  return fail(401, 'Invalid PIN.');
}

export async function getKioskWorkerSession(userId: string) {
  const worker = await resolveKioskWorker(userId);
  if (!worker) {
    return fail(401, 'Kiosk session is no longer valid.');
  }

  const [departmentsResult, activeContextResult] = await Promise.all([
    getDepartmentsOrdered(),
    buildActiveTimerContext(userId),
  ]);
  if (departmentsResult.ok === false) return departmentsResult;
  if (activeContextResult.ok === false) return activeContextResult;

  return ok({
    worker: sanitizeWorker(worker),
    departments: departmentsResult.data.items,
    ...activeContextResult.data,
  });
}

export async function unlockKioskByPin(pin: string) {
  return authenticateKioskWorker(pin);
}

export async function unlockKioskByWorkerPin({
  userId,
  pin,
}: {
  userId: string;
  pin: string;
}) {
  return authenticateKioskWorker(pin, userId);
}

export async function getKioskSessionContext(userId: string) {
  const result = await getKioskWorkerSession(userId);
  if (result.ok === false) return result;

  return ok({
    worker: result.data.worker,
    departments: result.data.departments,
    defaultDepartmentId:
      result.data.worker?.primaryDepartmentId ?? result.data.departments[0]?.id ?? null,
    activeTimer: result.data.activeEntry
      ? {
          ...result.data.activeEntry,
          order: result.data.activeOrder,
          part: result.data.activePart,
          elapsedSeconds: result.data.elapsedSeconds,
        }
      : null,
  });
}

export async function listKioskPartsForDepartment({
  departmentId,
  query,
  take,
}: {
  departmentId: string;
  query?: string;
  take?: number;
}) {
  const items = await searchKioskPartsForDepartment({ departmentId, query, take });
  return ok({ items });
}

export async function startKioskWorkerTimer({
  userId,
  orderId,
  partId,
  departmentId,
  switchAction,
}: {
  userId: string;
  orderId: string;
  partId: string;
  departmentId: string;
  switchAction?: 'pause' | 'finish';
}) {
  const worker = await resolveKioskWorker(userId);
  if (!worker) {
    return fail(401, 'Kiosk session is no longer valid.');
  }

  const departmentsResult = await getDepartmentsOrdered();
  if (departmentsResult.ok === false) return departmentsResult;
  const selectedDepartment = departmentsResult.data.items.find((department) => department.id === departmentId);
  if (!selectedDepartment) return fail(400, 'Department not found.');
  if (selectedDepartment.name.trim().toLowerCase() === 'shipping') {
    return fail(400, 'Shipping timers are disabled.');
  }

  const partResult = await getOrderPartSummary(orderId, partId);
  if (partResult.ok === false) return partResult;

  const ackResult = await requirePartInstructionAcknowledgement({
    orderId,
    partId,
    userId,
    departmentId,
  });
  if (ackResult.ok === false) return ackResult;

  const activeContextResult = await buildActiveTimerContext(userId);
  if (activeContextResult.ok === false) return activeContextResult;
  const activeEntry = activeContextResult.data.activeEntry;

  if (activeEntry) {
    if (!switchAction) {
      return fail(409, {
        message: 'Active time entry already running.',
        requiredAction: 'switch_confirmation',
        activeEntry: activeContextResult.data.activeEntry,
        activeOrder: activeContextResult.data.activeOrder,
        activePart: activeContextResult.data.activePart,
        elapsedSeconds: activeContextResult.data.elapsedSeconds,
      });
    }

    const closeResult =
      switchAction === 'pause' ? await pauseActiveTimeEntry(userId) : await stopActiveTimeEntry(userId);
    if (closeResult.ok === false) return closeResult;

    const closedEntry = closeResult.data.entry;
    if (closedEntry.partId) {
      await logPartEvent({
        orderId: closedEntry.orderId,
        partId: closedEntry.partId,
        userId,
        type: switchAction === 'pause' ? 'TIMER_PAUSED' : 'TIMER_FINISHED',
        message: switchAction === 'pause' ? 'Timer paused from kiosk switch.' : 'Timer finished from kiosk switch.',
        meta: { timeEntryId: closedEntry.id, transitionSource: 'kiosk_switch' },
      });
      await syncOrderWorkflowStatus(closedEntry.orderId, { userId });
    }
  }

  const startResult = await startTimeEntry(userId, {
    orderId,
    partId,
    departmentId,
    operation: 'Part Work',
  });
  if (startResult.ok === false) return startResult;

  await logPartEvent({
    orderId,
    partId,
    userId,
    type: 'TIMER_STARTED',
    message: 'Timer started from kiosk.',
    meta: { timeEntryId: startResult.data.entry.id, transitionSource: 'kiosk' },
  });
  await syncOrderWorkflowStatus(orderId, { userId });

  return ok({ entry: startResult.data.entry });
}

export async function startKioskTimer({
  userId,
  orderId,
  partId,
  departmentId,
}: {
  userId: string;
  orderId: string;
  partId: string;
  departmentId: string;
}) {
  return startKioskWorkerTimer({ userId, orderId, partId, departmentId });
}

export async function pauseKioskWorkerTimer(userId: string) {
  if (!(await resolveKioskWorker(userId))) {
    return fail(401, 'Kiosk session is no longer valid.');
  }

  const result = await pauseActiveTimeEntry(userId);
  if (result.ok === false) return result;

  if (result.data.entry.partId) {
    await logPartEvent({
      orderId: result.data.entry.orderId,
      partId: result.data.entry.partId,
      userId,
      type: 'TIMER_PAUSED',
      message: 'Timer paused from kiosk.',
      meta: { timeEntryId: result.data.entry.id, transitionSource: 'kiosk' },
    });
  }

  return ok({ entry: result.data.entry });
}

export async function finishKioskWorkerTimer(userId: string) {
  if (!(await resolveKioskWorker(userId))) {
    return fail(401, 'Kiosk session is no longer valid.');
  }

  const result = await stopActiveTimeEntry(userId);
  if (result.ok === false) return result;

  if (result.data.entry.partId) {
    await logPartEvent({
      orderId: result.data.entry.orderId,
      partId: result.data.entry.partId,
      userId,
      type: 'TIMER_FINISHED',
      message: 'Timer finished from kiosk.',
      meta: { timeEntryId: result.data.entry.id, transitionSource: 'kiosk' },
    });
    await syncOrderWorkflowStatus(result.data.entry.orderId, { userId });
  }

  return ok({ entry: result.data.entry });
}

export async function searchKioskParts({
  userId,
  departmentId,
  query,
  take,
}: {
  userId: string;
  departmentId: string;
  query?: string;
  take?: number;
}) {
  if (!(await resolveKioskWorker(userId))) {
    return fail(401, 'Kiosk session is no longer valid.');
  }
  return listKioskPartsForDepartment({ departmentId, query, take });
}

export async function pauseKioskTimer(userId: string) {
  return pauseKioskWorkerTimer(userId);
}

export async function finishKioskTimer(userId: string) {
  return finishKioskWorkerTimer(userId);
}

export async function switchKioskTimer({
  userId,
  orderId,
  partId,
  departmentId,
  stopMode,
}: {
  userId: string;
  orderId: string;
  partId: string;
  departmentId: string;
  stopMode: 'pause' | 'finish';
}) {
  return startKioskWorkerTimer({
    userId,
    orderId,
    partId,
    departmentId,
    switchAction: stopMode,
  });
}
