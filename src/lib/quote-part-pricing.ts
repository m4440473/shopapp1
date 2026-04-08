import type { QuoteMetadata, QuotePartPricingEntry } from '@/lib/quote-metadata';

type PartLike = {
  name: string;
  partNumber?: string | null;
  addonSelections?: Array<{ totalCents: number }>;
};

const normalizePartIdentity = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizeStoredEntry = (entry: QuotePartPricingEntry) => ({
  name: entry?.name ?? null,
  partNumber: entry?.partNumber ?? null,
  priceCents: Math.max(0, Number.isFinite(entry?.priceCents) ? Math.round(entry.priceCents) : 0),
  pricingMode: entry?.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL',
});

export const getPartPricingEntries = ({
  parts,
  metadata,
}: {
  parts: PartLike[];
  metadata?: QuoteMetadata | null;
}): QuotePartPricingEntry[] => {
  if (!parts.length) return [];

  const storedRaw = Array.isArray(metadata?.partPricing) ? metadata.partPricing : [];
  const stored = storedRaw.map((entry) => normalizeStoredEntry(entry));
  const assignedStoredIndexes = new Set<number>();

  return parts.map((part, index) => {
    const normalizedPartNumber = normalizePartIdentity(part.partNumber);
    const normalizedName = normalizePartIdentity(part.name);

    const identityMatchIndex = stored.findIndex((entry, candidateIndex) => {
      if (assignedStoredIndexes.has(candidateIndex)) return false;
      const entryPartNumber = normalizePartIdentity(entry.partNumber);
      const entryName = normalizePartIdentity(entry.name);
      if (normalizedPartNumber && entryPartNumber) {
        return normalizedPartNumber === entryPartNumber;
      }
      if (normalizedName && entryName) {
        return normalizedName === entryName;
      }
      return false;
    });

    const fallbackIndexMatch =
      identityMatchIndex >= 0 || assignedStoredIndexes.has(index) || !stored[index]
        ? -1
        : index;

    const selectedIndex = identityMatchIndex >= 0 ? identityMatchIndex : fallbackIndexMatch;
    if (selectedIndex >= 0) {
      assignedStoredIndexes.add(selectedIndex);
      const entry = stored[selectedIndex];
      return {
        name: entry.name ?? part.name,
        partNumber: entry.partNumber ?? part.partNumber ?? null,
        priceCents: entry.priceCents,
        pricingMode: entry.pricingMode,
      } satisfies QuotePartPricingEntry;
    }

    const fallbackPriceCents = (part.addonSelections ?? []).reduce(
      (sum, selection) => sum + (selection.totalCents || 0),
      0,
    );

    return {
      name: part.name,
      partNumber: part.partNumber ?? null,
      priceCents: fallbackPriceCents,
      pricingMode: 'LOT_TOTAL',
    } satisfies QuotePartPricingEntry;
  });
};
