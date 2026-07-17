import { describe, expect, it } from 'vitest';
import { formatLaborDuration, groupPartLaborHistory, type PartLaborHistoryEntry } from '../part-labor-history';

const NOW = Date.parse('2026-07-17T16:00:00.000Z');

function entry(overrides: Partial<PartLaborHistoryEntry> & Pick<PartLaborHistoryEntry, 'id' | 'userId'>): PartLaborHistoryEntry {
  return {
    startedAt: '2026-07-17T14:00:00.000Z',
    endedAt: '2026-07-17T15:00:00.000Z',
    user: { id: overrides.userId, name: overrides.userId },
    ...overrides,
  };
}

describe('groupPartLaborHistory', () => {
  it('groups intervals by employee and includes running time in employee and part totals', () => {
    const summary = groupPartLaborHistory([
      entry({ id: 'jim-closed', userId: 'jim', user: { id: 'jim', name: 'Jim' } }),
      entry({
        id: 'jim-running',
        userId: 'jim',
        user: { id: 'jim', name: 'Jim' },
        startedAt: '2026-07-17T15:30:00.000Z',
        endedAt: null,
      }),
      entry({
        id: 'bill-closed',
        userId: 'bill',
        user: { id: 'bill', name: 'Bill' },
        startedAt: '2026-07-17T13:00:00.000Z',
        endedAt: '2026-07-17T14:15:00.000Z',
      }),
    ], NOW);

    expect(summary).toMatchObject({
      closedSeconds: 8100,
      runningSeconds: 1800,
      totalSeconds: 9900,
      activeTimerCount: 1,
    });
    expect(summary.employees.map((employee) => employee.label)).toEqual(['Jim', 'Bill']);
    expect(summary.employees[0]).toMatchObject({ closedSeconds: 3600, runningSeconds: 1800, totalSeconds: 5400 });
  });

  it('keeps console actions in chronological order and supports legacy intervals without actions', () => {
    const summary = groupPartLaborHistory([
      entry({
        id: 'with-actions',
        userId: 'jim',
        actions: [
          { action: 'PAUSE', createdAt: '2026-07-17T15:00:00.000Z', actor: { id: 'boss', name: 'Boss' } },
          { action: 'START', createdAt: '2026-07-17T14:00:00.000Z', actor: { id: 'matt', name: 'Matt' } },
        ],
      }),
      entry({ id: 'legacy', userId: 'bill', actions: undefined }),
    ], NOW);

    expect(summary.employees.find((employee) => employee.userId === 'jim')?.intervals[0].actions.map((action) => action.action))
      .toEqual(['START', 'PAUSE']);
    expect(summary.employees.find((employee) => employee.userId === 'bill')?.intervals[0].actions).toEqual([]);
  });

  it('ignores malformed closed intervals instead of corrupting totals', () => {
    const summary = groupPartLaborHistory([
      entry({ id: 'backwards', userId: 'jim', startedAt: '2026-07-17T15:00:00.000Z', endedAt: '2026-07-17T14:00:00.000Z' }),
      entry({ id: 'bad-date', userId: 'bill', startedAt: 'not-a-date' }),
    ], NOW);

    expect(summary.employees).toEqual([]);
    expect(summary.totalSeconds).toBe(0);
  });

  it('sorts inactive employees by subtotal and intervals newest first', () => {
    const summary = groupPartLaborHistory([
      entry({ id: 'bill-old', userId: 'bill', user: { id: 'bill', name: 'Bill' }, startedAt: '2026-07-17T10:00:00.000Z', endedAt: '2026-07-17T10:30:00.000Z' }),
      entry({ id: 'bill-new', userId: 'bill', user: { id: 'bill', name: 'Bill' }, startedAt: '2026-07-17T12:00:00.000Z', endedAt: '2026-07-17T13:00:00.000Z' }),
      entry({ id: 'jim', userId: 'jim', user: { id: 'jim', name: 'Jim' }, startedAt: '2026-07-17T12:00:00.000Z', endedAt: '2026-07-17T12:45:00.000Z' }),
    ], NOW);

    expect(summary.employees.map((employee) => employee.label)).toEqual(['Bill', 'Jim']);
    expect(summary.employees[0].intervals.map((interval) => interval.id)).toEqual(['bill-new', 'bill-old']);
  });
});

describe('formatLaborDuration', () => {
  it('uses shop-friendly hour and minute labels', () => {
    expect(formatLaborDuration(18 * 3600 + 42 * 60)).toBe('18 hr 42 min');
    expect(formatLaborDuration(3600)).toBe('1 hr');
    expect(formatLaborDuration(59)).toBe('< 1 min');
  });
});
