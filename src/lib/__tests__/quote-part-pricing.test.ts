import { describe, expect, it } from 'vitest';

import { parseQuoteMetadata, stringifyQuoteMetadata } from '@/lib/quote-metadata';
import { getPartPricingEntries } from '@/lib/quote-part-pricing';

describe('quote part-pricing metadata round-trip', () => {
  it('preserves entered priceCents and pricingMode through stringify/parse', () => {
    const metadata = {
      partPricing: [
        {
          quotePartId: 'part-a',
          name: 'Part A',
          partNumber: 'A-100',
          priceCents: 500,
          pricingMode: 'PER_UNIT' as const,
          priceSource: 'CALCULATED' as const,
          suggestedUnitPriceCents: 500,
        },
        {
          quotePartId: 'part-b',
          name: 'Part B',
          partNumber: 'B-200',
          priceCents: 900,
          pricingMode: 'LOT_TOTAL' as const,
          priceSource: 'MANUAL' as const,
          suggestedUnitPriceCents: 450,
        },
      ],
    };

    const stored = stringifyQuoteMetadata(metadata);
    const parsed = parseQuoteMetadata(stored);

    expect(parsed?.partPricing).toEqual(metadata.partPricing);
  });

  it('matches stored entries by part identity before index fallback', () => {
    const metadata = {
      partPricing: [
        { name: 'Bracket', partNumber: 'BR-2', priceCents: 700, pricingMode: 'LOT_TOTAL' as const },
        { name: 'Plate', partNumber: 'PL-1', priceCents: 300, pricingMode: 'PER_UNIT' as const },
      ],
    };

    const projected = getPartPricingEntries({
      parts: [
        { name: 'Plate', partNumber: 'PL-1', addonSelections: [{ totalCents: 10 }] },
        { name: 'Bracket', partNumber: 'BR-2', addonSelections: [{ totalCents: 20 }] },
      ],
      metadata,
    });

    expect(projected).toEqual([
      {
        quotePartId: null,
        name: 'Plate',
        partNumber: 'PL-1',
        priceCents: 300,
        pricingMode: 'PER_UNIT',
        priceSource: 'MANUAL',
        suggestedUnitPriceCents: 0,
      },
      {
        quotePartId: null,
        name: 'Bracket',
        partNumber: 'BR-2',
        priceCents: 700,
        pricingMode: 'LOT_TOTAL',
        priceSource: 'MANUAL',
        suggestedUnitPriceCents: 0,
      },
    ]);
  });

  it('treats legacy stored prices as intentional manual lot totals', () => {
    const projected = getPartPricingEntries({
      parts: [{ name: 'Legacy', partNumber: 'L-1', addonSelections: [] }],
      metadata: {
        partPricing: [{ name: 'Legacy', partNumber: 'L-1', priceCents: 111 }],
      },
    });

    expect(projected[0]).toEqual({
      name: 'Legacy',
      partNumber: 'L-1',
      priceCents: 111,
      pricingMode: 'LOT_TOTAL',
      quotePartId: null,
      priceSource: 'MANUAL',
      suggestedUnitPriceCents: 0,
    });
  });

  it('uses stable quote-part identity before duplicate display labels', () => {
    const projected = getPartPricingEntries({
      parts: [
        { id: 'part-b', name: 'Bracket', partNumber: 'BR-1' },
        { id: 'part-a', name: 'Bracket', partNumber: 'BR-1' },
      ],
      metadata: {
        partPricing: [
          {
            quotePartId: 'part-a',
            name: 'Bracket',
            partNumber: 'BR-1',
            priceCents: 100,
            pricingMode: 'PER_UNIT',
            priceSource: 'MANUAL',
            suggestedUnitPriceCents: 90,
          },
          {
            quotePartId: 'part-b',
            name: 'Bracket',
            partNumber: 'BR-1',
            priceCents: 200,
            pricingMode: 'PER_UNIT',
            priceSource: 'MANUAL',
            suggestedUnitPriceCents: 180,
          },
        ],
      },
    });

    expect(projected.map((entry) => [entry.quotePartId, entry.priceCents])).toEqual([
      ['part-b', 200],
      ['part-a', 100],
    ]);
  });

  it('derives a calculated per-unit suggestion without losing fractional lot cents', () => {
    const [projected] = getPartPricingEntries({
      parts: [
        {
          id: 'part-a',
          name: 'Three brackets',
          quantity: 3,
          addonSelections: [{ totalCents: 1000 }],
        },
      ],
      metadata: null,
    });

    expect(projected).toEqual({
      quotePartId: 'part-a',
      name: 'Three brackets',
      partNumber: null,
      priceCents: 334,
      pricingMode: 'PER_UNIT',
      priceSource: 'CALCULATED',
      suggestedUnitPriceCents: 334,
    });
  });
});
