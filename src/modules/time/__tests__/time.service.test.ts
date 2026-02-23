import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('time.service', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops active entries with a correct duration', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { startTimeEntry, stopActiveTimeEntry } = await import('../time.service');

    const startResult = await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      operation: 'Part Work',
    });

    expect(startResult.ok).toBe(true);

    vi.setSystemTime(new Date('2026-02-03T00:10:00Z'));
    const stopResult = await stopActiveTimeEntry('user_test_machinist');

    expect(stopResult.ok).toBe(true);
    const entry = (stopResult as { ok: true; data: { entry: any } }).data.entry;
    const durationSeconds = Math.floor((entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000);
    expect(durationSeconds).toBe(600);
  });

  it('edits closed entries when owned by the requesting user', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { startTimeEntry, stopActiveTimeEntry, editClosedTimeEntry } = await import('../time.service');

    await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      operation: 'Part Work',
    });

    vi.setSystemTime(new Date('2026-02-03T00:10:00Z'));
    const stopResult = await stopActiveTimeEntry('user_test_machinist');
    expect(stopResult.ok).toBe(true);

    const closedEntry = (stopResult as { ok: true; data: { entry: any } }).data.entry;
    const editResult = await editClosedTimeEntry('user_test_machinist', {
      entryId: closedEntry.id,
      startedAt: new Date('2026-02-03T00:01:00Z'),
      endedAt: new Date('2026-02-03T00:09:00Z'),
      reason: 'Adjusted for delayed start punch',
    });

    expect(editResult.ok).toBe(true);
    const updated = (editResult as { ok: true; data: { entry: any } }).data.entry;
    expect(updated.startedAt.toISOString()).toBe('2026-02-03T00:01:00.000Z');
    expect(updated.endedAt?.toISOString()).toBe('2026-02-03T00:09:00.000Z');
  });

  it('rejects editing an active entry', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { startTimeEntry, editClosedTimeEntry } = await import('../time.service');

    const startResult = await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      operation: 'Part Work',
    });

    const activeEntry = (startResult as { ok: true; data: { entry: any } }).data.entry;
    const editResult = await editClosedTimeEntry('user_test_machinist', {
      entryId: activeEntry.id,
      startedAt: new Date('2026-02-03T00:00:00Z'),
      endedAt: new Date('2026-02-03T00:05:00Z'),
      reason: 'should fail',
    });

    expect(editResult.ok).toBe(false);
    expect((editResult as { ok: false; status: number }).status).toBe(409);
  });
});
