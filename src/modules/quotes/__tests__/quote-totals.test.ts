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
          priceSource: 'MANUAL',
        },
      ],
    });

    expect(total).toBe(10000 + 2500 + 9000 + 1800);
  });

  it('allows an admin to intentionally set a final part price to zero', () => {
    const total = calculateQuoteEstimateTotalCents({
      basePriceCents: 0,
      vendorTotalCents: 0,
      customAmountsCents: 0,
      addonMap: new Map([['machine', { rateCents: 5000, affectsPrice: true }]]),
      parts: [
        {
          name: 'Warranty repair',
          quantity: 1,
          pieceCount: 1,
          addonSelections: [{ addonId: 'machine', units: 2 }],
        },
      ],
      partPricing: [
        {
          name: 'Warranty repair',
          priceCents: 0,
          pricingMode: 'PER_UNIT',
          priceSource: 'MANUAL',
        },
      ],
    });

    expect(total).toBe(0);
  });

  it('uses each work step once and reconciles a calculated unit price back to quantity', () => {
    const total = calculateQuoteEstimateTotalCents({
      basePriceCents: 0,
      vendorTotalCents: 0,
      customAmountsCents: 0,
      addonMap: new Map([['machine', { rateCents: 1000, affectsPrice: true }]]),
      parts: [
        {
          name: 'Three brackets',
          quantity: 3,
          pieceCount: 1,
          addonSelections: [
            { addonId: 'machine', units: 1 },
            { addonId: 'machine', units: 9 },
          ],
        },
      ],
      partPricing: [
        {
          name: 'Three brackets',
          priceCents: 999999,
          pricingMode: 'PER_UNIT',
          priceSource: 'CALCULATED',
        },
      ],
    });

    expect(total).toBe(1002);
  });

  it('includes part-specific purchased material in its owning calculated part price once', () => {
    const total = calculateQuoteEstimateTotalCents({
      basePriceCents: 0,
      vendorTotalCents: 0,
      customAmountsCents: 0,
      addonMap: new Map([['machine', { rateCents: 17000, affectsPrice: true }]]),
      parts: [
        {
          name: 'Vertical rail mount',
          quantity: 1,
          pieceCount: 1,
          materialStatus: 'NEED_TO_ORDER',
          procurementCostCents: 3000,
          procurementMarkupPercent: 20,
          addonSelections: [{ addonId: 'machine', units: 1 }],
        },
      ],
      partPricing: [
        {
          name: 'Vertical rail mount',
          priceCents: 0,
          pricingMode: 'PER_UNIT',
          priceSource: 'CALCULATED',
        },
      ],
    });

    expect(total).toBe(20600);
  });
});
