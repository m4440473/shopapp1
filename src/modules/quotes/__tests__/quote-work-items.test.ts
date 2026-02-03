import { describe, expect, it } from 'vitest';

import { buildChecklistEntriesFromQuoteSelections } from '../quote-work-items';

describe('buildChecklistEntriesFromQuoteSelections', () => {
  it('creates per-part checklist entries from quote selections', () => {
    const selections = [
      {
        orderPartId: 'part-1',
        selection: {
          addonId: 'addon-1',
          addon: { departmentId: 'dept-1', isChecklistItem: true },
        },
      },
      {
        orderPartId: 'part-1',
        selection: {
          addonId: 'addon-1',
          addon: { departmentId: 'dept-1', isChecklistItem: true },
        },
      },
      {
        orderPartId: 'part-2',
        selection: {
          addonId: 'addon-2',
          addon: { departmentId: 'dept-2', isChecklistItem: false },
        },
      },
      {
        orderPartId: null,
        selection: {
          addonId: 'addon-3',
          addon: { departmentId: 'dept-3', isChecklistItem: true },
        },
      },
    ];

    const entries = buildChecklistEntriesFromQuoteSelections('order-1', selections);

    expect(entries).toEqual([
      {
        orderId: 'order-1',
        partId: 'part-1',
        addonId: 'addon-1',
        departmentId: 'dept-1',
        completed: false,
        isActive: true,
      },
    ]);
  });
});
