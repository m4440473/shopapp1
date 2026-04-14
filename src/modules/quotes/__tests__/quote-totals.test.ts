import { describe, expect, it } from 'vitest';

import { calculatePricedAddonTotal, calculateQuoteEstimateTotalCents } from '../quotes.service';

describe('calculatePricedAddonTotal', () => {
  it('ignores checklist-only items when totaling price', () => {
    const total = calculatePricedAddonTotal([
      { units: 2, rateCents: 1500, affectsPrice: true },
      { units: 3, rateCents: 2000, affectsPrice: false },
    ]);

    expect(total).toBe(3000);
  });

  it('includes custom amounts and part-pricing overrides in the saved estimate total', () => {
    const total = calculateQuoteEstimateTotalCents({
      basePriceCents: 10000,
      vendorTotalCents: 2500,
      customAmountsCents: 1800,
      addonMap: new Map([
        ['paint', { rateCents: 400, affectsPrice: true }],
        ['check', { rateCents: 150, affectsPrice: false }],
      ]),
      parts: [
        {
          name: 'Rail',
          quantity: 10,
          pieceCount: 1,
          addonSelections: [
            { addonId: 'paint', units: 12 },
            { addonId: 'check', units: 4 },
          ],
        },
      ],
      partPricing: [
        {
          name: 'Rail',
          priceCents: 900,
          pricingMode: 'PER_UNIT',
        },
      ],
    });

    expect(total).toBe(10000 + 2500 + 9000 + 1800);
  });
});
