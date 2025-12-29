import type { QuoteMetadata, QuotePartPricingEntry } from '@/lib/quote-metadata';

type PartLike = {
  name: string;
  partNumber?: string | null;
};

const buildEvenSplit = (totalCents: number, count: number): number[] => {
  if (count <= 0) return [];
  const even = Math.floor(totalCents / count);
  const remainder = totalCents - even * count;
  return Array.from({ length: count }, (_, index) => even + (index === count - 1 ? remainder : 0));
};

const isValidPricing = (entries: QuotePartPricingEntry[], expectedTotal: number, partCount: number) => {
  if (entries.length !== partCount) return false;
  const sum = entries.reduce((total, entry) => total + (entry.priceCents || 0), 0);
  return sum === expectedTotal;
};

export const getPartPricingEntries = ({
  parts,
  totalCents,
  metadata,
}: {
  parts: PartLike[];
  totalCents: number;
  metadata?: QuoteMetadata | null;
}): QuotePartPricingEntry[] => {
  if (!parts.length) return [];

  const stored = Array.isArray(metadata?.partPricing)
    ? metadata.partPricing.map((entry) => ({
        name: entry?.name ?? null,
        partNumber: entry?.partNumber ?? null,
        priceCents: entry?.priceCents ?? 0,
      }))
    : [];

  if (stored.length && isValidPricing(stored, totalCents, parts.length)) {
    return stored.map((entry, index) => ({
      name: entry.name ?? parts[index]?.name ?? null,
      partNumber: entry.partNumber ?? parts[index]?.partNumber ?? null,
      priceCents: entry.priceCents ?? 0,
    }));
  }

  const fallbackPrices = buildEvenSplit(totalCents, parts.length);
  return parts.map((part, index) => ({
    name: part.name,
    partNumber: part.partNumber ?? null,
    priceCents: fallbackPrices[index] ?? 0,
  }));
};
