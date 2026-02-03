import { describe, expect, it } from 'vitest';

import { calculatePricedAddonTotal } from '../quotes.service';

describe('calculatePricedAddonTotal', () => {
  it('ignores checklist-only items when totaling price', () => {
    const total = calculatePricedAddonTotal([
      { units: 2, rateCents: 1500, affectsPrice: true },
      { units: 3, rateCents: 2000, affectsPrice: false },
    ]);

    expect(total).toBe(3000);
  });
});
