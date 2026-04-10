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
      departmentId: 'dept_test_001',
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
      departmentId: 'dept_test_001',
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
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });

    const conflictResult = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_002',
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });

    expect(conflictResult.ok).toBe(false);
    expect((conflictResult as { ok: false; status: number }).status).toBe(409);

    const parallelResult = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_002',
      departmentId: 'dept_test_002',
      operation: 'Part Work',
    });
    expect(parallelResult.ok).toBe(false);
    expect((parallelResult as { ok: false; status: number }).status).toBe(409);

    const activeResult = await getActiveTimeEntry('user_test_machinist');
    expect(activeResult.ok).toBe(true);
    const activeEntry = (activeResult as { ok: true; data: { entry: any } }).data.entry;
    expect(activeEntry?.partId).toBe('part_test_001');
    expect(activeEntry?.endedAt).toBeNull();
  });

  it('prevents overlapping timers across departments for the same user', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getOrderPartTimeTotals, startTimeEntry, startTimeEntryWithConflict, stopTimeEntryById } = await import('../time.service');

    const switchOrderId = 'order_switch_test_001';
    const firstPartId = 'part_switch_test_001';
    const secondPartId = 'part_switch_test_002';

    const firstStart = await startTimeEntry('user_test_machinist', {
      orderId: switchOrderId,
      partId: firstPartId,
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });
    expect(firstStart.ok).toBe(true);
    const firstEntryId = (firstStart as { ok: true; data: { entry: any } }).data.entry.id;

    vi.setSystemTime(new Date('2026-02-03T00:10:00Z'));
    const secondDepartmentStart = await startTimeEntryWithConflict('user_test_machinist', {
      orderId: switchOrderId,
      partId: secondPartId,
      departmentId: 'dept_test_002',
      operation: 'Part Work',
    });
    expect(secondDepartmentStart.ok).toBe(false);

    vi.setSystemTime(new Date('2026-02-03T00:25:00Z'));
    const stoppedFirst = await stopTimeEntryById('user_test_machinist', firstEntryId);
    expect(stoppedFirst.ok).toBe(true);

    const totalsResult = await getOrderPartTimeTotals(switchOrderId, [firstPartId, secondPartId]);
    expect(totalsResult.ok).toBe(true);
    const totals = (totalsResult as { ok: true; data: { totalsSeconds: Record<string, number> } }).data.totalsSeconds;
    expect(totals[firstPartId]).toBe(1500);
    expect(totals[secondPartId] ?? 0).toBe(0);
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
      departmentId: 'dept_test_001',
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
      departmentId: 'dept_test_001',
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

  it('builds shared part activity with active timers and time by user', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getPartActivitySummary, startTimeEntry } = await import('../time.service');

    const startResult = await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_001',
      partId: 'part_test_001',
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });
    expect(startResult.ok).toBe(true);

    const activityResult = await getPartActivitySummary(['part_test_001']);
    expect(activityResult.ok).toBe(true);

    const activity = (activityResult as {
      ok: true;
      data: {
        partActivity: Record<
          string,
          {
            activeTimers: Array<{ userId: string; elapsedSeconds: number }>;
            timeByUser: Array<{ user?: { id?: string | null }; seconds: number }>;
            totalSeconds: number;
          }
        >;
      };
    }).data.partActivity['part_test_001'];

    expect(activity.activeTimers.some((entry) => entry.userId === 'user_test_machinist')).toBe(true);
    expect(activity.timeByUser.some((entry) => entry.user?.id === 'user_test_helper' && entry.seconds > 0)).toBe(true);
    expect(activity.totalSeconds).toBeGreaterThan(0);
  });

  it('builds reporting summaries by part, department, and user', async () => {
    vi.setSystemTime(new Date('2026-02-03T00:00:00Z'));
    vi.resetModules();
    const { getPartTimeReportingSummary, startTimeEntry } = await import('../time.service');

    const startResult = await startTimeEntry('user_test_machinist', {
      orderId: 'order_test_002',
      partId: 'part_test_003',
      departmentId: 'dept_test_001',
      operation: 'Part Work',
    });
    expect(startResult.ok).toBe(true);

    const summaryResult = await getPartTimeReportingSummary(['part_test_001', 'part_test_003']);
    expect(summaryResult.ok).toBe(true);
    const summary = (summaryResult as {
      ok: true;
      data: {
        totalsByPartDepartment: Record<string, Record<string, number>>;
        totalsByPartUser: Record<string, Record<string, number>>;
        totalsByDepartmentUser: Record<string, Record<string, number>>;
        activeByUser: Record<string, { partId: string | null }>;
      };
    }).data;

    expect(summary.totalsByPartDepartment['part_test_001']?.dept_test_001).toBeGreaterThan(0);
    expect(summary.totalsByPartUser['part_test_001']?.user_test_helper).toBeGreaterThan(0);
    expect(summary.totalsByDepartmentUser['dept_test_001']?.user_test_helper).toBeGreaterThan(0);
    expect(summary.activeByUser['user_test_machinist']?.partId).toBe('part_test_003');
  });
});
