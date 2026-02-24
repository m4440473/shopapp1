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


  it('returns conflict when starting while another entry is active', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getActiveTimeEntry, startTimeEntry, startTimeEntryWithConflict } = await import('../time.service');

    await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      operation: 'Part Work',
    });

    const conflictResult = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_002',
      operation: 'Part Work',
    });

    expect(conflictResult.ok).toBe(false);
    expect((conflictResult as { ok: false; status: number }).status).toBe(409);

    const activeResult = await getActiveTimeEntry('user_test_machinist');
    expect(activeResult.ok).toBe(true);
    const activeEntry = (activeResult as { ok: true; data: { entry: any } }).data.entry;
    expect(activeEntry?.partId).toBe('part_test_001');
    expect(activeEntry?.endedAt).toBeNull();
  });

  it('switches without inflating time during confirmation path', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getOrderPartTimeTotals, pauseActiveTimeEntry, startTimeEntry, startTimeEntryWithConflict } = await import('../time.service');

    const switchOrderId = 'order_switch_test_001';
    const firstPartId = 'part_switch_test_001';
    const secondPartId = 'part_switch_test_002';

    await startTimeEntry('user_test_machinist', {
      orderId: switchOrderId,
      partId: firstPartId,
      operation: 'Part Work',
    });

    vi.setSystemTime(new Date('2026-02-03T00:10:00Z'));
    const conflictResult = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: switchOrderId,
      partId: secondPartId,
      operation: 'Part Work',
    });
    expect(conflictResult.ok).toBe(false);

    const paused = await pauseActiveTimeEntry('user_test_machinist');
    expect(paused.ok).toBe(true);

    vi.setSystemTime(new Date('2026-02-03T00:10:00Z'));
    const switched = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: switchOrderId,
      partId: secondPartId,
      operation: 'Part Work',
    });
    expect(switched.ok).toBe(true);

    vi.setSystemTime(new Date('2026-02-03T00:25:00Z'));
    const closedSecond = await pauseActiveTimeEntry('user_test_machinist');
    expect(closedSecond.ok).toBe(true);

    const totalsResult = await getOrderPartTimeTotals(switchOrderId, [firstPartId, secondPartId]);
    expect(totalsResult.ok).toBe(true);
    const totals = (totalsResult as { ok: true; data: { totalsSeconds: Record<string, number> } }).data.totalsSeconds;
    expect(totals[firstPartId]).toBe(600);
    expect(totals[secondPartId]).toBe(900);
  });


  it('resumes a paused entry as a continued segment without losing prior time', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getOrderPartTimeTotals, pauseActiveTimeEntry, resumeTimeEntry, startTimeEntry } = await import('../time.service');

    const orderId = 'order_resume_test_001';
    const partId = 'part_resume_test_001';

    const startResult = await startTimeEntry('user_test_machinist', {
      orderId,
      partId,
      operation: 'Part Work',
    });
    expect(startResult.ok).toBe(true);

    vi.setSystemTime(new Date('2026-02-03T00:12:00Z'));
    const paused = await pauseActiveTimeEntry('user_test_machinist');
    expect(paused.ok).toBe(true);

    const pausedEntry = (paused as { ok: true; data: { entry: any } }).data.entry;

    vi.setSystemTime(new Date('2026-02-03T00:20:00Z'));
    const resumed = await resumeTimeEntry('user_test_machinist', { entryId: pausedEntry.id });
    expect(resumed.ok).toBe(true);

    vi.setSystemTime(new Date('2026-02-03T00:35:00Z'));
    const pausedAgain = await pauseActiveTimeEntry('user_test_machinist');
    expect(pausedAgain.ok).toBe(true);

    const totalsResult = await getOrderPartTimeTotals(orderId, [partId]);
    expect(totalsResult.ok).toBe(true);
    const totals = (totalsResult as { ok: true; data: { totalsSeconds: Record<string, number> } }).data.totalsSeconds;
    expect(totals[partId]).toBe(1620);
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
