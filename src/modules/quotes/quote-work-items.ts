export type QuoteChecklistSelection = {
  orderPartId: string | null;
  selection: {
    addonId?: string | null;
    addon?: { departmentId?: string | null; isChecklistItem?: boolean | null } | null;
  };
};

export type ChecklistEntryInput = {
  orderId: string;
  partId: string;
  addonId: string;
  departmentId: string | null;
  completed: boolean;
  isActive: boolean;
};

export function buildChecklistEntriesFromQuoteSelections(
  orderId: string,
  selections: QuoteChecklistSelection[],
): ChecklistEntryInput[] {
  const seen = new Set<string>();
  const entries: ChecklistEntryInput[] = [];

  for (const entry of selections) {
    if (!entry.orderPartId) continue;
    const addonId = entry.selection.addonId;
    if (!addonId) continue;
    if (!entry.selection.addon?.isChecklistItem) continue;
    const key = `${entry.orderPartId}:${addonId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      orderId,
      partId: entry.orderPartId,
      addonId,
      departmentId: entry.selection.addon?.departmentId ?? null,
      completed: false,
      isActive: true,
    });
  }

  return entries;
}
