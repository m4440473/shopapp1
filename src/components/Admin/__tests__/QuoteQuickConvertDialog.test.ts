import { describe, expect, it } from 'vitest';

import { validateQuickConvertPayload } from '../QuoteQuickConvertDialog';

describe('validateQuickConvertPayload', () => {
  it('requires due date and assigned machinist', () => {
    const result = validateQuickConvertPayload({
      dueDate: '',
      priority: 'NORMAL',
      assignedMachinistId: '',
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
      poNumber: ' PO-123 ',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      dueDate: '2026-04-30',
      priority: 'RUSH',
      assignedMachinistId: 'mach-1',
      poNumber: 'PO-123',
    });
  });
});
