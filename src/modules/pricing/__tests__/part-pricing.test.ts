import { describe, expect, it } from 'vitest';

import { calculatePartLotTotal } from '@/modules/pricing/part-pricing';

describe('calculatePartLotTotal', () => {
  it('uses entered total directly for LOT_TOTAL', () => {
    expect(calculatePartLotTotal({ enteredPriceCents: 500, quantity: 5, pricingMode: 'LOT_TOTAL' })).toBe(500);
  });

  it('extends entered unit price for PER_UNIT', () => {
    expect(calculatePartLotTotal({ enteredPriceCents: 500, quantity: 5, pricingMode: 'PER_UNIT' })).toBe(2500);
  });
});
