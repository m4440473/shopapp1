import type { QuoteMetadata, QuotePartPricingEntry } from '@/lib/quote-metadata';

type PartLike = {
  name: string;
  partNumber?: string | null;
  addonSelections?: Array<{ totalCents: number }>;
};

const isValidPricing = (entries: QuotePartPricingEntry[], expectedTotal: number, partCount: number) => {
  if (entries.length !== partCount) return false;
  const sum = entries.reduce((total, entry) => total + (entry.priceCents || 0), 0);
  return sum === expectedTotal;
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

  if (stored.length && isValidPricing(stored, expectedTotal, parts.length)) {
    return stored.map((entry, index) => ({
      name: entry.name ?? parts[index]?.name ?? null,
      partNumber: entry.partNumber ?? parts[index]?.partNumber ?? null,
      priceCents: entry.priceCents ?? 0,
    }));
  }

  return parts.map((part, index) => ({
    name: part.name,
    partNumber: part.partNumber ?? null,
    priceCents: partTotals[index] ?? 0,
  }));
};
