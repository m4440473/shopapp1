import { describe, expect, it } from 'vitest';
import {
  calculateAssignmentTotalCents,
  calculateWorkItemsSubtotalCents,
  getWorkItemPricingSemantic,
} from '@/modules/pricing/work-item-pricing';

describe('work-item-pricing', () => {
  it('marks affectsPrice=false items as checklist-only', () => {
    expect(getWorkItemPricingSemantic({ affectsPrice: false, rateCents: 500 })).toBe('CHECKLIST_ONLY');
  });

  it('calculates priced assignment totals from rate x units', () => {
    expect(calculateAssignmentTotalCents({ item: { rateCents: 1250, affectsPrice: true }, units: 2.5 })).toBe(3125);
  });

  it('excludes checklist-only selections from subtotal', () => {
    const items = new Map([
      ['a', { rateCents: 1000, affectsPrice: true }],
      ['b', { rateCents: 2500, affectsPrice: false }],
    ]);

    const subtotal = calculateWorkItemsSubtotalCents({
      selections: [
        { addonId: 'a', units: 2 },
        { addonId: 'b', units: 4 },
      ],
      itemsById: items,
    });

    expect(subtotal).toBe(2000);
  });
});
