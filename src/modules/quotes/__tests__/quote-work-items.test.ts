import { describe, expect, it } from 'vitest';

import {
  buildChecklistEntriesFromQuoteSelections,
  buildOrderChargeEntriesFromQuoteData,
} from '../quote-work-items';

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

  it('builds priced order charges and falls back custom amounts to the origin department', () => {
    const charges = buildOrderChargeEntriesFromQuoteData({
      orderId: 'order-1',
      selections: [
        {
          orderPartId: 'part-1',
          selection: {
            addonId: 'addon-1',
            units: 12,
            notes: 'Paint both sides',
            addon: {
              name: 'Wet Paint',
              departmentId: 'paint',
              affectsPrice: true,
              rateCents: 450,
            },
          },
        },
      ],
      customAmounts: [{ title: 'Rush paint setup', amountCents: 17500 }],
      customAmountPartId: 'part-1',
      fallbackDepartmentId: 'paint',
    });

    expect(charges).toEqual([
      {
        orderId: 'order-1',
        partId: 'part-1',
        departmentId: 'paint',
        addonId: 'addon-1',
        kind: 'ADDON',
        name: 'Wet Paint',
        description: 'Paint both sides',
        quantity: 12,
        unitPriceCents: 450,
        sortOrder: 0,
      },
      {
        orderId: 'order-1',
        partId: 'part-1',
        departmentId: 'paint',
        addonId: null,
        kind: 'CUSTOM',
        name: 'Rush paint setup',
        description: null,
        quantity: 1,
        unitPriceCents: 17500,
        sortOrder: 1,
      },
    ]);
  });
});
