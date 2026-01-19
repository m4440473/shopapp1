export type QuoteDetailWithRelations = any;

export type QuoteSummaryWithRelations = any;

export type OrderWithRelations = any;

export type SanitizedQuoteSummary = Omit<
  QuoteSummaryWithRelations,
  'basePriceCents' | 'addonsTotalCents' | 'vendorTotalCents' | 'totalCents'
>;

type SanitizedAddonSelection = Omit<
  QuoteDetailWithRelations['addonSelections'][number],
  'rateCents' | 'totalCents' | 'addon'
> & {
  addon: QuoteDetailWithRelations['addonSelections'][number]['addon'] extends null
    ? null
    : Omit<NonNullable<QuoteDetailWithRelations['addonSelections'][number]['addon']>, 'rateCents'>;
};

type SanitizedVendorItem = Omit<
  QuoteDetailWithRelations['vendorItems'][number],
  'basePriceCents' | 'finalPriceCents'
>;

export type SanitizedQuoteDetail = Omit<
  QuoteDetailWithRelations,
  'basePriceCents' | 'addonsTotalCents' | 'vendorTotalCents' | 'totalCents' | 'vendorItems' | 'addonSelections'
> & {
  vendorItems: SanitizedVendorItem[];
  addonSelections: SanitizedAddonSelection[];
};

type SanitizedOrderChecklistEntry = Omit<OrderWithRelations['checklist'][number], 'addon'> & {
  addon: OrderWithRelations['checklist'][number]['addon'] extends null
    ? null
    : Omit<NonNullable<OrderWithRelations['checklist'][number]['addon']>, 'rateCents'>;
};

type SanitizedOrderCharge = OrderWithRelations extends { charges: Array<infer Charge> }
  ? Omit<Charge, 'unitPrice'> & { unitPrice?: never }
  : never;

export type SanitizedOrder = Omit<OrderWithRelations, 'checklist' | 'charges'> & {
  checklist: SanitizedOrderChecklistEntry[];
  charges: SanitizedOrderCharge[];
};

type SanitizableEntity = QuoteDetailWithRelations | QuoteSummaryWithRelations | OrderWithRelations;

export function sanitizePricingForNonAdmin(entity: SanitizableEntity, isAdmin = false) {
  if (isAdmin) return entity;

  if ('quoteNumber' in entity) {
    const { basePriceCents, addonsTotalCents, vendorTotalCents, totalCents, vendorItems, addonSelections, ...rest } =
      entity as QuoteDetailWithRelations;

    if (vendorItems && addonSelections) {
      const strippedVendorItems = vendorItems.map(({ basePriceCents: _, finalPriceCents: __, ...item }) => item);
      const strippedAddonSelections = addonSelections.map(({ rateCents: _, totalCents: __, addon, ...selection }) => ({
        ...selection,
        addon: addon ? (({ rateCents: ___, ...addonRest }) => addonRest)(addon) : addon,
      }));

      const strippedParts = (rest as any).parts
        ? (rest as any).parts.map((part: any) => ({
            ...part,
            addonSelections: (part.addonSelections || []).map(({ rateCents: _, totalCents: __, addon, ...selection }: any) => ({
              ...selection,
              addon: addon ? (({ rateCents: ___, ...addonRest }) => addonRest)(addon) : addon,
            })),
          }))
        : (rest as any).parts;

      return {
        ...rest,
        vendorItems: strippedVendorItems,
        addonSelections: strippedAddonSelections,
        parts: strippedParts,
      };
    }

    const { basePriceCents: _b, addonsTotalCents: _a, vendorTotalCents: _v, totalCents: _t, ...summary } =
      entity as QuoteSummaryWithRelations;
    return summary;
  }

  if ('orderNumber' in entity) {
    const order = entity as OrderWithRelations;
    return {
      ...order,
      checklist: (order.checklist || []).map(({ addon, ...checklist }) => ({
        ...checklist,
        addon: addon ? (({ rateCents: _, ...addonRest }) => addonRest)(addon) : addon,
      })),
      parts: (order.parts || []).map((part: any) => ({
        ...part,
        charges: (part.charges || []).map(({ unitPrice: _, ...charge }: any) => charge),
      })),
      charges: (order.charges || []).map(({ unitPrice: _, ...charge }) => charge),
    };
  }

  return entity;
}
