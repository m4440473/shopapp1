import { describe, expect, it } from 'vitest';

import { deriveWorkflowStatusFromSnapshot, normalizeOrderWorkflowStatus } from '../orders.service';

describe('order workflow status helpers', () => {
  it('normalizes legacy in-progress statuses into IN_PROGRESS', () => {
    expect(normalizeOrderWorkflowStatus('RUNNING')).toBe('IN_PROGRESS');
    expect(normalizeOrderWorkflowStatus('READY_FOR_ADDONS')).toBe('IN_PROGRESS');
  });

  it('keeps closed orders closed regardless of part activity', () => {
    expect(
      deriveWorkflowStatusFromSnapshot({
        status: 'CLOSED',
        parts: [{ id: 'part-1', status: 'COMPLETE' }],
        checklist: [{partId: 'part-1', completed: true, isActive: true }],
        timeEntries: [{ id: 'entry-1' }],
      }),
    ).toBe('CLOSED');
  });

  it('returns COMPLETE when every part is complete', () => {
    expect(
      deriveWorkflowStatusFromSnapshot({
        status: 'IN_PROGRESS',
        parts: [
          { id: 'part-1', status: 'COMPLETE' },
          { id: 'part-2', status: 'COMPLETE' },
        ],
        checklist: [
          {partId: 'part-1', completed: true, isActive: true },
          {partId: 'part-2', completed: true, isActive: true },
        ],
      }),
    ).toBe('COMPLETE');
  });

  it('returns RECEIVED when nothing has started yet', () => {
    expect(
      deriveWorkflowStatusFromSnapshot({
        status: 'RECEIVED',
        parts: [{ id: 'part-1', status: 'IN_PROGRESS' }],
        checklist: [{partId: 'part-1', completed: false, isActive: true }],
        timeEntries: [],
        partEvents: [],
      }),
    ).toBe('RECEIVED');
  });

  it('returns IN_PROGRESS once tracked work exists', () => {
    expect(
      deriveWorkflowStatusFromSnapshot({
        status: 'RECEIVED',
        parts: [{ id: 'part-1', status: 'IN_PROGRESS' }],
        checklist: [{partId: 'part-1', completed: false, isActive: true }],
        timeEntries: [{ id: 'entry-1' }],
      }),
    ).toBe('IN_PROGRESS');
  });
});
