import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  closeTimeEntryById,
  createTimeEntry,
  findActiveTimeEntryForUser,
  findLatestTimeEntriesForUserParts,
  findLatestTimeEntryForUserOrder,
  findTimeEntryById,
  listTimeEntriesForOrderParts,
  updateClosedTimeEntryById,
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


function mapTimeEntryCreateError(error: unknown): ServiceResult<{ entry: TimeEntry }> | null {
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
    return fail(
      409,
      'Timer could not be started because your user session is out of sync with the database. Sign out and sign back in, then retry.'
    );
  }

  return null;
}

export async function getActiveTimeEntry(userId: string): Promise<ServiceResult<{ entry: TimeEntry | null }>> {
  const entry = await findActiveTimeEntryForUser(userId);
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
    const closeResult = await closeTimeEntryById(active.id, now);
    if (closeResult.count === 0) {
      return fail(409, 'Active time entry could not be closed.');
    }
  }

  try {
    const entry = await createTimeEntry({
      userId,
      orderId: input.orderId,
      partId: input.partId ?? null,
      operation: input.operation,
      startedAt: now,
    });

    return ok({ entry });
  } catch (error) {
    return mapTimeEntryCreateError(error) ?? fail(500, 'Failed to start timer entry.');
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
      operation: input.operation,
      startedAt: new Date(),
    });

    return ok({ entry });
  } catch (error) {
    return mapTimeEntryCreateError(error) ?? fail(500, 'Failed to start timer entry.');
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

  const now = new Date();
  const active = await findActiveTimeEntryForUser(userId);
  if (active) {
    const closeResult = await closeTimeEntryById(active.id, now);
    if (closeResult.count === 0) {
      return fail(409, 'Active time entry could not be closed.');
    }
  }

  const entry = await createTimeEntry({
    userId,
    orderId: previous.orderId,
    partId: previous.partId,
    operation: previous.operation,
    startedAt: now,
  });

  return ok({ entry });
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

export function computeEntryMinutes(entries: Array<Pick<TimeEntry, 'startedAt' | 'endedAt'>>) {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return total;
    return total + Math.round(diffMs / 60000);
  }, 0);
}


export async function editClosedTimeEntry(
  userId: string,
  input: TimeEntryClosedEditInput
): Promise<ServiceResult<{ entry: TimeEntry }>> {
  const entry = await findTimeEntryById(input.entryId);
  if (!entry) {
    return fail(404, 'Time entry not found.');
  }

  if (entry.userId !== userId) {
    return fail(403, 'Cannot edit a time entry owned by another user.');
  }

  if (!entry.endedAt) {
    return fail(409, 'Only closed time entries can be edited.');
  }

  if (input.endedAt.getTime() <= input.startedAt.getTime()) {
    return fail(400, 'endedAt must be later than startedAt.');
  }

  const updated = await updateClosedTimeEntryById(input.entryId, {
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });

  if (!updated) {
    return fail(409, 'Closed time entry update conflict.');
  }

  return ok({ entry: updated });
}
