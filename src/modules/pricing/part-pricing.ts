export type PartPricingMode = 'PER_UNIT' | 'LOT_TOTAL';

export function calculatePartLotTotal({
  enteredPriceCents,
  quantity,
  pricingMode,
}: {
  enteredPriceCents: number;
  quantity: number;
  pricingMode: PartPricingMode;
}) {
  const safePrice = Number.isFinite(enteredPriceCents) ? Math.max(0, Math.round(enteredPriceCents)) : 0;
  const safeQty = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
  if (pricingMode === 'PER_UNIT') {
    return safePrice * safeQty;
  }
  return safePrice;
}
