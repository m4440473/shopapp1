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

export type SanitizedOrder = Omit<OrderWithRelations, 'checklist'> & {
  checklist: SanitizedOrderChecklistEntry[];
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

      return {
        ...rest,
        vendorItems: strippedVendorItems,
        addonSelections: strippedAddonSelections,
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
    };
  }

  return entity;
}
