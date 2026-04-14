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

export type QuoteChargeSelection = {
  orderPartId: string | null;
  selection: {
    addonId?: string | null;
    units?: number | null;
    notes?: string | null;
    addon?: {
      name?: string | null;
      departmentId?: string | null;
      affectsPrice?: boolean | null;
      rateCents?: number | null;
    } | null;
  };
};

export type CustomQuoteAmountInput = {
  title: string;
  amountCents: number;
};

export type QuoteOrderChargeInput = {
  orderId: string;
  partId: string;
  departmentId: string;
  addonId: string | null;
  kind: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  sortOrder: number;
};

export function buildOrderChargeEntriesFromQuoteData({
  orderId,
  selections,
  customAmounts,
  customAmountPartId,
  fallbackDepartmentId,
}: {
  orderId: string;
  selections: QuoteChargeSelection[];
  customAmounts?: CustomQuoteAmountInput[];
  customAmountPartId?: string | null;
  fallbackDepartmentId?: string | null;
}): QuoteOrderChargeInput[] {
  const charges: QuoteOrderChargeInput[] = [];

  for (const entry of selections) {
    const partId = entry.orderPartId;
    const addon = entry.selection.addon;
    if (!partId || addon?.affectsPrice === false) continue;
    const departmentId = addon?.departmentId ?? fallbackDepartmentId ?? null;
    if (!departmentId) continue;
    charges.push({
      orderId,
      partId,
      departmentId,
      addonId: entry.selection.addonId ?? null,
      kind: 'ADDON',
      name: addon?.name ?? 'Add-on',
      description: entry.selection.notes ?? null,
      quantity: Number(entry.selection.units ?? 0) || 0,
      unitPriceCents: Number(addon?.rateCents ?? 0) || 0,
      sortOrder: charges.length,
    });
  }

  for (const customAmount of customAmounts ?? []) {
    const title = customAmount.title.trim();
    if (!title || customAmount.amountCents <= 0 || !customAmountPartId || !fallbackDepartmentId) continue;
    charges.push({
      orderId,
      partId: customAmountPartId,
      departmentId: fallbackDepartmentId,
      addonId: null,
      kind: 'CUSTOM',
      name: title,
      description: null,
      quantity: 1,
      unitPriceCents: customAmount.amountCents,
      sortOrder: charges.length,
    });
  }

  return charges;
}
