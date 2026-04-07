export type WorkItemPricingInput = {
  rateCents?: number | null;
  affectsPrice?: boolean | null;
  isChecklistItem?: boolean | null;
};

export type WorkItemPricingSemantic = 'PRICED_WORK' | 'CHECKLIST_ONLY';

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
