import { describe, expect, it } from 'vitest';

import {
  calculatePartLotTotal,
  calculatePartUnitPrice,
  calculateProcurementTotalCents,
  calculateSuggestedPartUnitPriceCents,
} from '@/modules/pricing/part-pricing';

describe('calculatePartLotTotal', () => {
  it('uses entered total directly for LOT_TOTAL', () => {
    expect(calculatePartLotTotal({ enteredPriceCents: 500, quantity: 5, pricingMode: 'LOT_TOTAL' })).toBe(500);
  });

  it('extends entered unit price for PER_UNIT', () => {
    expect(calculatePartLotTotal({ enteredPriceCents: 500, quantity: 5, pricingMode: 'PER_UNIT' })).toBe(2500);
  });

  it('recalculates deterministically when mode toggles with same entered value', () => {
    const quantity = 4;
    const enteredPriceCents = 1250;

    const lotTotal = calculatePartLotTotal({ enteredPriceCents, quantity, pricingMode: 'LOT_TOTAL' });
    const perUnitTotal = calculatePartLotTotal({ enteredPriceCents, quantity, pricingMode: 'PER_UNIT' });
    const toggledBack = calculatePartLotTotal({ enteredPriceCents, quantity, pricingMode: 'LOT_TOTAL' });

    expect(lotTotal).toBe(1250);
    expect(perUnitTotal).toBe(5000);
    expect(toggledBack).toBe(1250);
  });
});

describe('calculatePartUnitPrice', () => {
  it('keeps entered value as unit price in PER_UNIT mode', () => {
    expect(calculatePartUnitPrice({ enteredPriceCents: 1234, quantity: 8, pricingMode: 'PER_UNIT' })).toBe(1234);
  });

  it('derives display unit price from lot total and quantity in LOT_TOTAL mode', () => {
    expect(calculatePartUnitPrice({ enteredPriceCents: 1000, quantity: 4, pricingMode: 'LOT_TOTAL' })).toBe(250);
  });

  it('falls back safely when lot-total quantity is zero', () => {
    expect(calculatePartUnitPrice({ enteredPriceCents: 1000, quantity: 0, pricingMode: 'LOT_TOTAL' })).toBe(1000);
  });
});

describe('calculated part pricing', () => {
  it('adds marked-up purchased material to the suggested part price', () => {
    const procurementTotalCents = calculateProcurementTotalCents({
      baseCostCents: 3000,
      markupPercent: 20,
    });

    expect(procurementTotalCents).toBe(3600);
    expect(calculateSuggestedPartUnitPriceCents({
      workItemsSubtotalCents: 17000,
      procurementTotalCents,
      quantity: 1,
    })).toBe(20600);
  });

  it('spreads the part-level purchase across the quoted quantity', () => {
    expect(calculateSuggestedPartUnitPriceCents({
      workItemsSubtotalCents: 6000,
      procurementTotalCents: 3600,
      quantity: 3,
    })).toBe(3200);
  });
});
