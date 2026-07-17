import type { QuoteMetadata, QuotePartPricingEntry } from '@/lib/quote-metadata';

type PartLike = {
  id?: string | null;
  name: string;
  partNumber?: string | null;
  quantity?: number | null;
  addonSelections?: Array<{ totalCents: number }>;
};

const normalizePartIdentity = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizeStoredEntry = (entry: QuotePartPricingEntry): QuotePartPricingEntry => ({
  name: entry?.name ?? null,
  partNumber: entry?.partNumber ?? null,
  quotePartId: entry?.quotePartId ?? null,
  priceCents: Math.max(0, Number.isFinite(entry?.priceCents) ? Math.round(entry.priceCents) : 0),
  pricingMode: entry?.pricingMode === 'PER_UNIT' ? ('PER_UNIT' as const) : ('LOT_TOTAL' as const),
  priceSource: entry?.priceSource === 'CALCULATED' ? ('CALCULATED' as const) : ('MANUAL' as const),
  suggestedUnitPriceCents: Math.max(0, Math.round(Number(entry?.suggestedUnitPriceCents ?? 0) || 0)),
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
    const stableIdMatchIndex = part.id
      ? stored.findIndex(
          (entry, candidateIndex) =>
            !assignedStoredIndexes.has(candidateIndex) && entry.quotePartId === part.id,
        )
      : -1;
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
      stableIdMatchIndex >= 0 || identityMatchIndex >= 0 || assignedStoredIndexes.has(index) || !stored[index]
        ? -1
        : index;

    const selectedIndex =
      stableIdMatchIndex >= 0
        ? stableIdMatchIndex
        : identityMatchIndex >= 0
          ? identityMatchIndex
          : fallbackIndexMatch;
    if (selectedIndex >= 0) {
      assignedStoredIndexes.add(selectedIndex);
      const entry = stored[selectedIndex];
      return {
        name: entry.name ?? part.name,
        partNumber: entry.partNumber ?? part.partNumber ?? null,
        quotePartId: entry.quotePartId ?? part.id ?? null,
        priceCents: entry.priceCents,
        pricingMode: entry.pricingMode,
        priceSource: entry.priceSource,
        suggestedUnitPriceCents: entry.suggestedUnitPriceCents,
      } satisfies QuotePartPricingEntry;
    }

    const fallbackLineCents = (part.addonSelections ?? []).reduce(
      (sum, selection) => sum + (selection.totalCents || 0),
      0,
    );
    const quantity = Math.max(1, Math.round(Number(part.quantity ?? 1) || 1));
    const suggestedUnitPriceCents = Math.ceil(fallbackLineCents / quantity);

    return {
      quotePartId: part.id ?? null,
      name: part.name,
      partNumber: part.partNumber ?? null,
      priceCents: suggestedUnitPriceCents,
      pricingMode: 'PER_UNIT',
      priceSource: 'CALCULATED',
      suggestedUnitPriceCents,
    } satisfies QuotePartPricingEntry;
  });
};
