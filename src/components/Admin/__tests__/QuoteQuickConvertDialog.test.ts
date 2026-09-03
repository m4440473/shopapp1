import { describe, expect, it } from 'vitest';

import { validateQuickConvertPayload } from '../QuoteQuickConvertDialog';

describe('validateQuickConvertPayload', () => {
  it('requires a due date but allows an order without a coordinator', () => {
    const result = validateQuickConvertPayload({
      dueDate: '',
      priority: 'NORMAL',
      assignedMachinistId: '',
      assignedWorkerIds: [],
      poNumber: '',
    });

    expect(result.payload).toBeNull();
    expect(result.error).toBe('Due date is required.');
  });

  it('builds conversion payload with normalized optional fields', () => {
    const result = validateQuickConvertPayload({
      dueDate: '2026-04-30',
      priority: 'RUSH',
      assignedMachinistId: ' mach-1 ',
      assignedWorkerIds: [' worker-1 ', 'worker-2', 'worker-1'],
      poNumber: ' PO-123 ',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      dueDate: '2026-04-30',
      priority: 'RUSH',
      assignedMachinistId: 'mach-1',
      assignedWorkerIds: ['worker-1', 'worker-2'],
      poNumber: 'PO-123',
    });
  });

  it('omits an empty coordinator while preserving assigned workers', () => {
    const result = validateQuickConvertPayload({
      dueDate: '2026-04-30',
      priority: 'NORMAL',
      assignedMachinistId: ' ',
      assignedWorkerIds: ['worker-1'],
      poNumber: '',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      dueDate: '2026-04-30',
      priority: 'NORMAL',
      assignedWorkerIds: ['worker-1'],
    });
  });
});
