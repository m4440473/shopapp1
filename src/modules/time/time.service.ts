import {
  closeTimeEntryById,
  createTimeEntry,
  findActiveTimeEntryForUser,
  findTimeEntryById,
} from './time.repo';
import type { TimeEntry, TimeEntryResumeInput, TimeEntryStartInput } from './time.types';

export type { TimeEntry, TimeEntryResumeInput, TimeEntryStartInput };

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function getActiveTimeEntry(userId: string): Promise<ServiceResult<{ entry: TimeEntry | null }>> {
  const entry = await findActiveTimeEntryForUser(userId);
  return ok({ entry });
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

  const entry = await createTimeEntry({
    userId,
    orderId: input.orderId,
    partId: input.partId ?? null,
    operation: input.operation,
    startedAt: now,
  });

  return ok({ entry });
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

export function computeEntryMinutes(entries: Array<Pick<TimeEntry, 'startedAt' | 'endedAt'>>) {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return total;
    return total + Math.round(diffMs / 60000);
  }, 0);
}
