export type PartPricingMode = 'PER_UNIT' | 'LOT_TOTAL';

const sanitizeCents = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

const sanitizeQty = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

export function calculatePartLotTotal({
  enteredPriceCents,
  quantity,
  pricingMode,
}: {
  enteredPriceCents: number;
  quantity: number;
  pricingMode: PartPricingMode;
}) {
  const safePrice = sanitizeCents(enteredPriceCents);
  const safeQty = sanitizeQty(quantity);
  if (pricingMode === 'PER_UNIT') {
    return safePrice * safeQty;
  }
  return safePrice;
}

export function calculatePartUnitPrice({
  enteredPriceCents,
  quantity,
  pricingMode,
}: {
  enteredPriceCents: number;
  quantity: number;
  pricingMode: PartPricingMode;
}) {
  const safePrice = sanitizeCents(enteredPriceCents);
  const safeQty = sanitizeQty(quantity);

  if (pricingMode === 'PER_UNIT') {
    return safePrice;
  }

  if (safeQty <= 0) {
    return safePrice;
  }

  return Math.round(safePrice / safeQty);
}

export function calculateProcurementTotalCents({
  baseCostCents,
  markupPercent,
}: {
  baseCostCents: number;
  markupPercent?: number | null;
}) {
  const safeBaseCost = sanitizeCents(baseCostCents);
  const safeMarkupPercent = typeof markupPercent === 'number' && Number.isFinite(markupPercent)
    ? Math.max(0, markupPercent)
    : 0;

  return Math.round(safeBaseCost * (1 + safeMarkupPercent / 100));
}

export function calculateSuggestedPartUnitPriceCents({
  workItemsSubtotalCents,
  procurementTotalCents = 0,
  quantity,
}: {
  workItemsSubtotalCents: number;
  procurementTotalCents?: number | null;
  quantity: number;
}) {
  const safeWorkSubtotal = sanitizeCents(workItemsSubtotalCents);
  const safeProcurementTotal = sanitizeCents(procurementTotalCents ?? 0);
  const safeQuantity = Math.max(1, sanitizeQty(quantity));

  return Math.ceil((safeWorkSubtotal + safeProcurementTotal) / safeQuantity);
}
