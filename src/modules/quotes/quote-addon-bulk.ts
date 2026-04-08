export type QuoteAddonSelectionLike = {
  key: string;
  addonId: string;
  units: string;
  notes: string;
};

export type QuoteAddonPresetItem = {
  addonId: string;
  units: string;
  notes: string;
};

export type QuoteAddonPreset = {
  id: string;
  name: string;
  items: QuoteAddonPresetItem[];
};

export function dedupePresetItems(items: QuoteAddonPresetItem[]) {
  const seen = new Set<string>();
  const next: QuoteAddonPresetItem[] = [];
  for (const item of items) {
    const addonId = (item.addonId || '').trim();
    if (!addonId || seen.has(addonId)) continue;
    seen.add(addonId);
    next.push({
      addonId,
      units: item.units || '1.0',
      notes: item.notes || '',
    });
  }
  return next;
}

export function mergeSelectionsWithoutDuplicates({
  existing,
  incoming,
  createKey,
}: {
  existing: QuoteAddonSelectionLike[];
  incoming: QuoteAddonPresetItem[];
  createKey: () => string;
}) {
  const existingAddonIds = new Set(existing.map((item) => item.addonId));
  const appended = incoming
    .filter((item) => item.addonId && !existingAddonIds.has(item.addonId))
    .map((item) => ({
      key: createKey(),
      addonId: item.addonId,
      units: item.units || '1.0',
      notes: item.notes || '',
    }));

  return [...existing, ...appended];
}

export function buildPresetFromSelections({
  selections,
  selectedKeys,
}: {
  selections: QuoteAddonSelectionLike[];
  selectedKeys: string[];
}) {
  const selected = new Set(selectedKeys);
  const items = selections
    .filter((selection) => selected.has(selection.key))
    .map((selection) => ({
      addonId: selection.addonId,
      units: selection.units || '1.0',
      notes: selection.notes || '',
    }));

  return dedupePresetItems(items);
}
