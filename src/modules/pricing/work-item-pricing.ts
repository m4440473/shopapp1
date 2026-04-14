export type WorkItemPricingInput = {
  rateType?: string | null;
  rateCents?: number | null;
  affectsPrice?: boolean | null;
  isChecklistItem?: boolean | null;
};

export type WorkItemPricingSemantic = 'PRICED_WORK' | 'CHECKLIST_ONLY';
export type WorkItemRateType = 'HOURLY' | 'FLAT' | 'PER_FOOT';

export const normalizeWorkItemRateType = (rateType?: string | null): WorkItemRateType => {
  if (rateType === 'FLAT') return 'FLAT';
  if (rateType === 'PER_FOOT') return 'PER_FOOT';
  return 'HOURLY';
};

export const getWorkItemUnitsLabel = (
  rateType?: string | null,
  variant: 'long' | 'short' = 'long'
) => {
  const normalized = normalizeWorkItemRateType(rateType);
  if (normalized === 'HOURLY') return variant === 'short' ? 'hrs' : 'Hours';
  if (normalized === 'PER_FOOT') return variant === 'short' ? 'ft' : 'Feet';
  return variant === 'short' ? 'qty' : 'Quantity';
};

export const formatWorkItemRateLabel = ({
  rateCents,
  rateType,
}: {
  rateCents?: number | null;
  rateType?: string | null;
}) => {
  if (typeof rateCents !== 'number') return null;
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(rateCents / 100);
  const normalized = normalizeWorkItemRateType(rateType);
  if (normalized === 'HOURLY') return `${formatted}/hr`;
  if (normalized === 'PER_FOOT') return `${formatted}/ft`;
  return formatted;
};

export const getWorkItemPricingSemantic = (item: WorkItemPricingInput): WorkItemPricingSemantic => {
  if (item.affectsPrice === false) return 'CHECKLIST_ONLY';
  return 'PRICED_WORK';
};

export const calculateAssignmentTotalCents = ({
  item,
  units,
}: {
  item: WorkItemPricingInput;
  units: number;
}) => {
  const normalizedUnits = Number.isFinite(units) && units > 0 ? units : 0;
  if (getWorkItemPricingSemantic(item) === 'CHECKLIST_ONLY') return 0;
  const rateCents = typeof item.rateCents === 'number' ? item.rateCents : 0;
  return Math.round(rateCents * normalizedUnits);
};

export const calculateWorkItemsSubtotalCents = <
  TSelection extends { addonId: string; units: number },
  TItem extends WorkItemPricingInput,
>({
  selections,
  itemsById,
}: {
  selections: TSelection[];
  itemsById: Map<string, TItem>;
}) =>
  selections.reduce((sum, selection) => {
    const item = itemsById.get(selection.addonId);
    if (!item) return sum;
    return sum + calculateAssignmentTotalCents({ item, units: selection.units });
  }, 0);

export const calculatePartPricingSummaryTotalsCents = <
  TPart extends {
    workItemsSubtotalCents: number;
    partPricingSubtotalCents: number;
    hasPartPricingOverride: boolean;
  },
>({
  parts,
}: {
  parts: TPart[];
}) =>
  parts.reduce(
    (totals, part) => {
      if (part.hasPartPricingOverride) {
        totals.partPricingCents += part.partPricingSubtotalCents;
      } else {
        totals.addonsAndLaborCents += part.workItemsSubtotalCents;
      }
      return totals;
    },
    { addonsAndLaborCents: 0, partPricingCents: 0 }
  );
