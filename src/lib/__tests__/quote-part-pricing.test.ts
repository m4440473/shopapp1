import { describe, expect, it } from 'vitest';

import { parseQuoteMetadata, stringifyQuoteMetadata } from '@/lib/quote-metadata';
import { getPartPricingEntries } from '@/lib/quote-part-pricing';

describe('quote part-pricing metadata round-trip', () => {
  it('preserves entered priceCents and pricingMode through stringify/parse', () => {
    const metadata = {
      partPricing: [
        { name: 'Part A', partNumber: 'A-100', priceCents: 500, pricingMode: 'PER_UNIT' as const },
        { name: 'Part B', partNumber: 'B-200', priceCents: 900, pricingMode: 'LOT_TOTAL' as const },
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
      { name: 'Plate', partNumber: 'PL-1', priceCents: 300, pricingMode: 'PER_UNIT' },
      { name: 'Bracket', partNumber: 'BR-2', priceCents: 700, pricingMode: 'LOT_TOTAL' },
    ]);
  });

  it('defaults legacy entries without pricingMode to LOT_TOTAL', () => {
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
    });
  });
});
