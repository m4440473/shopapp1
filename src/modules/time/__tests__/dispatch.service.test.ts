import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('trusted dispatch timer service', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    process.env.TEST_MODE_USE_MOCK_REPOS = 'true';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records the console actor separately and assigns the labor owner', async () => {
    const { startDispatchTimer } = await import('../dispatch.service');
    const { listTimeEntriesForPartsDetailed } = await import('@/repos/time');
    const { listPartWorkers } = await import('@/modules/orders/orders.service');

    const result = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_test_001',
    });

    expect(result.ok).toBe(true);
    const entries = await listTimeEntriesForPartsDetailed(['part_test_001']);
    const entry = entries.find((item) => item.userId === 'user_test_helper');
    expect(entry?.actions[0]?.action).toBe('START');
    expect(entry?.actions[0]?.actorUserId).toBe('test-user');

    const workers = await listPartWorkers('order_test_001', 'part_test_001');
    expect(workers.ok).toBe(true);
    expect(
      (workers as { ok: true; data: { assignments: Array<{ userId: string }> } }).data.assignments
        .some((assignment) => assignment.userId === 'user_test_helper'),
    ).toBe(true);
  });

  it('requires confirmation and atomically pauses the previous part when switching', async () => {
    const { startDispatchTimer } = await import('../dispatch.service');
    const { getActiveTimeEntry } = await import('../time.service');
    const { listTimeEntriesForPartsDetailed } = await import('@/repos/time');

    const first = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_machinist',
      orderId: 'order_test_001',
      partId: 'part_test_001',
    });
    expect(first.ok).toBe(true);

    vi.setSystemTime(new Date('2026-07-17T13:00:00Z'));
    const conflict = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_machinist',
      orderId: 'order_test_002',
      partId: 'part_test_003',
    });
    expect(conflict.ok).toBe(false);
    expect((conflict as { ok: false; error: any }).error.requiredAction).toBe('switch_confirmation');

    const switched = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_machinist',
      orderId: 'order_test_002',
      partId: 'part_test_003',
      confirmSwitch: true,
    });
    expect(switched.ok).toBe(true);

    const active = await getActiveTimeEntry('user_test_machinist');
    expect(active.ok).toBe(true);
    expect((active as { ok: true; data: { entry: { partId: string } } }).data.entry.partId)
      .toBe('part_test_003');

    const entries = await listTimeEntriesForPartsDetailed(['part_test_001', 'part_test_003']);
    const previous = entries.find((entry) => entry.partId === 'part_test_001');
    const replacement = entries.find((entry) => entry.partId === 'part_test_003');
    expect(previous?.endedAt?.toISOString()).toBe('2026-07-17T13:00:00.000Z');
    expect(previous?.actions.some((action) => action.action === 'PAUSE')).toBe(true);
    expect(replacement?.actions.some((action) => action.action === 'SWITCH_START')).toBe(true);
  });

  it('requires a saved acknowledgement receipt before the selected employee timer can start', async () => {
    const { startDispatchTimer } = await import('../dispatch.service');
    const { acknowledgePartInstructions } = await import('@/modules/orders/orders.service');

    const blocked = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
    });
    expect(blocked.ok).toBe(false);
    expect((blocked as { ok: false; error: any }).error.requiredAction)
      .toBe('instruction_confirmation');

    const checkboxBypass = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      instructionsConfirmed: true,
    } as any);
    expect(checkboxBypass.ok).toBe(false);

    const acknowledgement = await acknowledgePartInstructions({
      actorUserId: 'test-user',
      userId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      departmentId: 'dept_test_001',
    });
    expect(acknowledgement.ok).toBe(true);

    const started = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
    });
    expect(started.ok).toBe(true);
  });

  it('pauses a selected employee timer without removing the part assignment', async () => {
    const { closeDispatchTimer, startDispatchTimer } = await import('../dispatch.service');
    const { listPartWorkers } = await import('@/modules/orders/orders.service');

    const started = await startDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_test_001',
    });
    expect(started.ok).toBe(true);
    const entryId = (started as { ok: true; data: { entry: { id: string } } }).data.entry.id;

    const paused = await closeDispatchTimer({
      actorUserId: 'test-user',
      workerUserId: 'user_test_helper',
      entryId,
      action: 'PAUSE',
    });
    expect(paused.ok).toBe(true);

    const workers = await listPartWorkers('order_test_001', 'part_test_001');
    expect(
      (workers as { ok: true; data: { assignments: Array<{ userId: string; isActive: boolean }> } })
        .data.assignments.some(
          (assignment) => assignment.userId === 'user_test_helper' && assignment.isActive,
        ),
    ).toBe(true);
  });
});
