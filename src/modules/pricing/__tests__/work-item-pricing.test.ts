import { describe, expect, it } from 'vitest';
import {
  calculateAssignmentTotalCents,
  calculatePartPricingSummaryTotalsCents,
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

  it('replaces raw work-item subtotal with basis-adjusted part pricing when override is present', () => {
    const totals = calculatePartPricingSummaryTotalsCents({
      parts: [
        {
          workItemsSubtotalCents: 24500,
          partPricingSubtotalCents: 73500,
          hasPartPricingOverride: true,
        },
        {
          workItemsSubtotalCents: 12000,
          partPricingSubtotalCents: 0,
          hasPartPricingOverride: false,
        },
      ],
    });

    expect(totals).toEqual({
      addonsAndLaborCents: 12000,
      partPricingCents: 73500,
    });
  });
});
