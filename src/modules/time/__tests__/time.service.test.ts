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
});
