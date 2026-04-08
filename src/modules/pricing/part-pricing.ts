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
