import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  closeTimeEntryById,
  closeWorkerTimeEntryWithAction,
  createTimeEntry,
  createTimeEntryWithAction,
  findActiveTimeEntryForUser,
  findLatestTimeEntriesForUserParts,
  findLatestTimeEntryForUserOrder,
  findTimeEntryById,
  listActiveTimeEntriesForUser,
  listActiveTimeEntriesDetailed,
  listActiveTimeEntriesForPart,
  listTimeEntriesForOrderParts,
  listTimeEntriesForPartsDetailed,
  switchTimeEntryWithActions,
  updateClosedTimeEntryById,
  updateClosedTimeEntryWithAudit,
} from '@/repos/time';
import type {
  TimeEntry,
  TimeEntryClosedEditInput,
  TimeEntryResumeInput,
  TimeEntryStartInput,
} from './time.types';

export type { TimeEntry, TimeEntryClosedEditInput, TimeEntryResumeInput, TimeEntryStartInput };

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}


function mapTimeEntryCreateError<T>(error: unknown): ServiceResult<T> | null {
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
    return fail(
      409,
      'Timer could not be started because the linked order, part, or user record is no longer available. Refresh and retry; if it persists, sign out and sign back in.'
    );
  }
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
    return fail(409, 'That employee already has a running timer. Refresh and try again.');
  }

  return null;
}

export type DispatchTimerInput = {
  orderId: string;
  partId: string;
  departmentId: string;
  operation?: string;
};

export async function startWorkerTimer(
  actorUserId: string,
  workerUserId: string,
  input: DispatchTimerInput,
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  try {
    const result = await createTimeEntryWithAction({
      actorUserId,
      workerUserId,
      orderId: input.orderId,
      partId: input.partId,
      departmentId: input.departmentId,
      operation: input.operation ?? 'Part Work',
    });
    if (!result.entry) {
      return {
        ok: false,
        status: 409,
        error: 'That employee is already working on another part.',
      };
    }
    return ok({ entry: result.entry });
  } catch (error) {
    return mapTimeEntryCreateError<{ entry: TimeEntry }>(error) ?? fail(500, 'Failed to start employee timer.');
  }
}

export async function switchWorkerTimer(
  actorUserId: string,
  workerUserId: string,
  input: DispatchTimerInput,
): Promise<ServiceResult<{ entry: TimeEntry; previousEntry: TimeEntry | null }>> {
  try {
    const result = await switchTimeEntryWithActions({
      actorUserId,
      workerUserId,
      orderId: input.orderId,
      partId: input.partId,
      departmentId: input.departmentId,
      operation: input.operation ?? 'Part Work',
    });
    return ok({ entry: result.entry, previousEntry: result.previousEntry });
  } catch (error) {
    return mapTimeEntryCreateError<{ entry: TimeEntry; previousEntry: TimeEntry | null }>(error)
      ?? fail(500, 'Failed to switch employee timer.');
  }
}

export async function closeWorkerTimer(
  actorUserId: string,
  workerUserId: string,
  input: {
    entryId?: string | null;
    action: 'PAUSE' | 'FINISH' | 'ADMIN_CLOSE';
    reason?: string | null;
  },
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const entry = await closeWorkerTimeEntryWithAction({
    actorUserId,
    workerUserId,
    entryId: input.entryId,
    action: input.action,
    reason: input.reason,
  });
  if (!entry) return fail(404, 'No matching active timer was found for that employee.');
  return ok({ entry });
}

export async function getRunningWorkerSummary() {
  const entries = await listActiveTimeEntriesDetailed();
  return ok({
    items: entries.map((entry) => ({
      entryId: entry.id,
      workerId: entry.userId,
      workerName: entry.user?.name ?? entry.user?.email ?? 'Employee',
      orderId: entry.orderId,
      orderNumber: entry.order?.orderNumber ?? entry.orderId,
      partId: entry.partId,
      partNumber: entry.part?.partNumber ?? null,
      partName: entry.part?.partName ?? null,
      departmentName: entry.department?.name ?? null,
      startedAt: entry.startedAt,
    })),
  });
}

export async function getActiveTimersForPart(partId: string) {
  const entries = await listActiveTimeEntriesForPart(partId);
  return ok({ entries });
}

export async function getActiveTimeEntry(userId: string): Promise<ServiceResult<{ entry: TimeEntry | null }>> {
  const entry = await findActiveTimeEntryForUser(userId);
  return ok({ entry });
}

export async function getActiveTimeEntries(userId: string): Promise<ServiceResult<{ entries: TimeEntry[] }>> {
  const entries = await listActiveTimeEntriesForUser(userId);
  return ok({ entries });
}

export async function getTimeEntryDetails(
  userId: string,
  entryId: string,
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const entry = await findTimeEntryById(entryId);
  if (!entry) {
    return fail(404, 'Time entry not found.');
  }

  if (entry.userId !== userId) {
    return fail(403, 'Cannot access a time entry owned by another user.');
  }

  return ok({ entry });
}

export async function getTimeEntrySummary(
  userId: string,
  orderId: string,
  partIds: string[]
): Promise<
  ServiceResult<{
    activeEntry: TimeEntry | null;
    lastOrderEntry: TimeEntry | null;
    lastPartEntries: Record<string, TimeEntry | null>;
  }>
> {
  const [activeEntry, lastOrderEntry, partEntries] = await Promise.all([
    findActiveTimeEntryForUser(userId),
    findLatestTimeEntryForUserOrder(userId, orderId, null),
    findLatestTimeEntriesForUserParts(userId, partIds),
  ]);

  const lastPartEntries: Record<string, TimeEntry | null> = {};
  partEntries.forEach((entry) => {
    if (!entry.partId) return;
    if (lastPartEntries[entry.partId]) return;
    lastPartEntries[entry.partId] = entry;
  });

  return ok({ activeEntry, lastOrderEntry, lastPartEntries });
}

export async function startTimeEntry(
  userId: string,
  input: TimeEntryStartInput
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const now = new Date();
  const active = await findActiveTimeEntryForUser(userId);
  if (active) {
    return fail(409, 'An active timer already exists for this user.');
  }

  try {
    const entry = await createTimeEntry({
      userId,
      orderId: input.orderId,
      partId: input.partId ?? null,
      departmentId: input.departmentId,
      operation: input.operation,
      startedAt: now,
    });

    return ok({ entry });
  } catch (error) {
    return mapTimeEntryCreateError<{ entry: TimeEntry }>(error) ?? fail(500, 'Failed to start timer entry.');
  }
}

export async function startTimeEntryWithConflict(
  userId: string,
  input: TimeEntryStartInput
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const active = await findActiveTimeEntryForUser(userId);
  if (active) {
    return fail(409, 'Active time entry already running.');
  }

  try {
    const entry = await createTimeEntry({
      userId,
      orderId: input.orderId,
      partId: input.partId ?? null,
      departmentId: input.departmentId,
      operation: input.operation,
      startedAt: new Date(),
    });

    return ok({ entry });
  } catch (error) {
    return mapTimeEntryCreateError<{ entry: TimeEntry }>(error) ?? fail(500, 'Failed to start timer entry.');
  }
}

export async function pauseActiveTimeEntry(
  userId: string
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const active = await findActiveTimeEntryForUser(userId);
  if (!active) {
    return fail(404, 'No active time entry to pause.');
  }

  const now = new Date();
  const closeResult = await closeTimeEntryById(active.id, now);
  if (closeResult.count === 0) {
    return fail(409, 'Time entry is already closed.');
  }

  return ok({ entry: { ...active, endedAt: now, updatedAt: now } });
}

export async function stopActiveTimeEntry(
  userId: string
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const active = await findActiveTimeEntryForUser(userId);
  if (!active) {
    return fail(404, 'No active time entry to stop.');
  }

  const now = new Date();
  const closeResult = await closeTimeEntryById(active.id, now);
  if (closeResult.count === 0) {
    return fail(409, 'Time entry is already closed.');
  }

  return ok({ entry: { ...active, endedAt: now, updatedAt: now } });
}

export async function stopTimeEntryById(
  userId: string,
  entryId: string
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const entry = await findTimeEntryById(entryId);
  if (!entry) {
    return fail(404, 'Time entry not found.');
  }

  if (entry.userId !== userId) {
    return fail(403, 'Cannot stop a time entry owned by another user.');
  }

  if (entry.endedAt) {
    return fail(409, 'Time entry is already closed.');
  }

  const now = new Date();
  const closeResult = await closeTimeEntryById(entry.id, now);
  if (closeResult.count === 0) {
    return fail(409, 'Time entry is already closed.');
  }

  return ok({ entry: { ...entry, endedAt: now, updatedAt: now } });
}

export async function resumeTimeEntry(
  userId: string,
  input: TimeEntryResumeInput
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const previous = await findTimeEntryById(input.entryId);
  if (!previous) {
    return fail(404, 'Time entry not found.');
  }

  if (previous.userId !== userId) {
    return fail(403, 'Cannot resume a time entry owned by another user.');
  }

  if (!previous.endedAt) {
    return fail(409, 'Cannot resume an entry that is still active.');
  }

  if (!previous.departmentId) {
    return fail(409, 'Cannot resume this timer because it has no department.');
  }

  const now = new Date();
  const active = await findActiveTimeEntryForUser(userId);
  if (active) {
    return fail(409, 'An active timer already exists for this user.');
  }

  try {
    const entry = await createTimeEntry({
      userId,
      orderId: previous.orderId,
      partId: previous.partId,
      departmentId: previous.departmentId,
      operation: previous.operation,
      startedAt: now,
    });

    return ok({ entry });
  } catch (error) {
    return mapTimeEntryCreateError<{ entry: TimeEntry }>(error) ?? fail(500, 'Failed to resume timer entry.');
  }
}

export async function getOrderPartTimeTotals(
  orderId: string,
  partIds: string[]
): Promise<ServiceResult<{ totalsSeconds: Record<string, number> }>> {
  if (!partIds.length) return ok({ totalsSeconds: {} });
  const entries = await listTimeEntriesForOrderParts(orderId, partIds);

  const totalsSeconds: Record<string, number> = {};
  entries.forEach((entry) => {
    if (!entry.partId || !entry.endedAt) return;
    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return;
    const seconds = Math.floor(diffMs / 1000);
    totalsSeconds[entry.partId] = (totalsSeconds[entry.partId] ?? 0) + seconds;
  });

  return ok({ totalsSeconds });
}

export async function getPartActivitySummary(
  partIds: string[],
): Promise<
  ServiceResult<{
    partActivity: Record<
      string,
      {
        activeTimers: Array<Record<string, unknown>>;
        timeByUser: Array<Record<string, unknown>>;
        totalSeconds: number;
      }
    >;
  }>
> {
  if (!partIds.length) return ok({ partActivity: {} });

  const entries = await listTimeEntriesForPartsDetailed(partIds);
  const partIdSet = new Set(partIds);
  const partActivity = Object.fromEntries(
    partIds.map((partId) => [
      partId,
      {
        activeTimers: [] as Array<Record<string, unknown>>,
        timeByUser: [] as Array<Record<string, unknown>>,
        totalSeconds: 0,
      },
    ]),
  ) as Record<
    string,
    {
      activeTimers: Array<Record<string, unknown>>;
      timeByUser: Array<Record<string, unknown>>;
      totalSeconds: number;
    }
  >;

  const totalsByPartUser = new Map<string, { partId: string; user: any; seconds: number }>();

  entries.forEach((entry) => {
    if (!entry.partId || !partIdSet.has(entry.partId)) return;
    const bucket = partActivity[entry.partId];
    if (!bucket) return;

    if (!entry.endedAt) {
      bucket.activeTimers.push({
        id: entry.id,
        orderId: entry.orderId,
        partId: entry.partId,
        departmentId: entry.departmentId,
        departmentName: entry.department?.name ?? null,
        userId: entry.userId,
        user: entry.user ?? null,
        operation: entry.operation,
        startedAt: entry.startedAt,
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)),
      });
      return;
    }

    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return;

    const seconds = Math.floor(diffMs / 1000);
    bucket.totalSeconds += seconds;
    const key = `${entry.partId}:${entry.userId}`;
    const existing = totalsByPartUser.get(key);
    if (existing) {
      existing.seconds += seconds;
      return;
    }

    totalsByPartUser.set(key, {
      partId: entry.partId,
      user: entry.user ?? null,
      seconds,
    });
  });

  totalsByPartUser.forEach((entry) => {
    partActivity[entry.partId]?.timeByUser.push({
      userId: entry.user?.id ?? null,
      user: entry.user ?? null,
      seconds: entry.seconds,
    });
  });

  Object.values(partActivity).forEach((entry) => {
    entry.activeTimers.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    entry.timeByUser.sort((a: any, b: any) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      const aName = a.user?.name ?? a.user?.email ?? a.userId ?? '';
      const bName = b.user?.name ?? b.user?.email ?? b.userId ?? '';
      return String(aName).localeCompare(String(bName), undefined, { sensitivity: 'base' });
    });
  });

  return ok({ partActivity });
}

export async function getPartTimeReportingSummary(
  partIds: string[],
): Promise<
  ServiceResult<{
    totalsByPartDepartment: Record<string, Record<string, number>>;
    totalsByPartUser: Record<string, Record<string, number>>;
    totalsByDepartmentUser: Record<string, Record<string, number>>;
    activeByUser: Record<string, TimeEntry>;
  }>
> {
  if (!partIds.length) {
    return ok({
      totalsByPartDepartment: {},
      totalsByPartUser: {},
      totalsByDepartmentUser: {},
      activeByUser: {},
    });
  }

  const entries = await listTimeEntriesForPartsDetailed(partIds);
  const totalsByPartDepartment: Record<string, Record<string, number>> = {};
  const totalsByPartUser: Record<string, Record<string, number>> = {};
  const totalsByDepartmentUser: Record<string, Record<string, number>> = {};
  const activeByUser: Record<string, TimeEntry> = {};

  entries.forEach((entry) => {
    if (!entry.partId) return;

    if (!entry.endedAt) {
      if (!activeByUser[entry.userId]) {
        activeByUser[entry.userId] = entry;
      }
      return;
    }

    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return;

    const seconds = Math.floor(diffMs / 1000);
    const partDepartmentKey = entry.departmentId ?? '__none__';
    const departmentUserKey = entry.departmentId ?? '__none__';

    totalsByPartDepartment[entry.partId] ??= {};
    totalsByPartDepartment[entry.partId][partDepartmentKey] =
      (totalsByPartDepartment[entry.partId][partDepartmentKey] ?? 0) + seconds;

    totalsByPartUser[entry.partId] ??= {};
    totalsByPartUser[entry.partId][entry.userId] =
      (totalsByPartUser[entry.partId][entry.userId] ?? 0) + seconds;

    totalsByDepartmentUser[departmentUserKey] ??= {};
    totalsByDepartmentUser[departmentUserKey][entry.userId] =
      (totalsByDepartmentUser[departmentUserKey][entry.userId] ?? 0) + seconds;
  });

  return ok({ totalsByPartDepartment, totalsByPartUser, totalsByDepartmentUser, activeByUser });
}

export function computeEntryMinutes(entries: Array<Pick<TimeEntry, 'startedAt' | 'endedAt'>>) {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return total;
    return total + Math.round(diffMs / 60000);
  }, 0);
}


export async function editClosedTimeEntry(
  actorUserId: string,
  input: TimeEntryClosedEditInput
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const entry = await findTimeEntryById(input.entryId);
  if (!entry) {
    return fail(404, 'Time entry not found.');
  }

  if (!entry.endedAt) {
    return fail(409, 'Only closed time entries can be edited.');
  }

  if (input.endedAt.getTime() <= input.startedAt.getTime()) {
    return fail(400, 'endedAt must be later than startedAt.');
  }

  const updated = await updateClosedTimeEntryWithAudit({
    entryId: input.entryId,
    actorUserId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    reason: input.reason,
  });

  if (!updated) {
    return fail(409, 'Closed time entry update conflict.');
  }
  if (updated.overlap) {
    return fail(409, 'That correction overlaps another interval for this employee.');
  }

  return ok({ entry: updated.entry });
}
