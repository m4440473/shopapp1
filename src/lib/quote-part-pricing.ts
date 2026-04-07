import type { QuoteMetadata, QuotePartPricingEntry } from '@/lib/quote-metadata';

type PartLike = {
  name: string;
  partNumber?: string | null;
  addonSelections?: Array<{ totalCents: number }>;
};

export const getPartPricingEntries = ({
  parts,
  metadata,
}: {
  parts: PartLike[];
  metadata?: QuoteMetadata | null;
}): QuotePartPricingEntry[] => {
  if (!parts.length) return [];

  const partTotals = parts.map((part) =>
    (part.addonSelections ?? []).reduce((sum, selection) => sum + (selection.totalCents || 0), 0)
  );
  const expectedTotal = partTotals.reduce((sum, total) => sum + total, 0);

  const stored = Array.isArray(metadata?.partPricing)
    ? metadata.partPricing.map((entry) => ({
        name: entry?.name ?? null,
        partNumber: entry?.partNumber ?? null,
        priceCents: entry?.priceCents ?? 0,
      }))
    : [];

  if (stored.length === parts.length) {
    return stored.map((entry, index) => ({
      name: entry.name ?? parts[index]?.name ?? null,
      partNumber: entry.partNumber ?? parts[index]?.partNumber ?? null,
      priceCents: entry.priceCents ?? 0,
      pricingMode: entry.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL',
    }));
  }

  return parts.map((part, index) => ({
    name: part.name,
    partNumber: part.partNumber ?? null,
    priceCents: partTotals[index] ?? 0,
    pricingMode: 'LOT_TOTAL',
  }));
};
