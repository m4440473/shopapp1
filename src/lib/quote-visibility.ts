import type { Prisma } from '.prisma/client';

export type QuoteDetailWithRelations = Prisma.QuoteGetPayload<{
  include: {
    customer: { select: { id: true; name: true } };
    createdBy: { select: { id: true; name: true; email: true } };
    parts: true;
    vendorItems: true;
    addonSelections: {
      include: {
        addon: { select: { id: true; name: true; rateType: true; rateCents: true } };
      };
    };
    attachments: true;
  };
}>;

export type QuoteSummaryWithRelations = Prisma.QuoteGetPayload<{
  include: {
    customer: { select: { id: true; name: true } };
    createdBy: { select: { id: true; name: true; email: true } };
  };
}>;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    parts: { include: { material: true } };
    checklist: { include: { addon: true } };
    statusHistory: true;
    notes: { include: { user: true } };
    attachments: true;
    assignedMachinist: true;
    vendor: true;
  };
}>;

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

type Sanitized<T extends SanitizableEntity> = T extends QuoteDetailWithRelations
  ? SanitizedQuoteDetail
  : T extends QuoteSummaryWithRelations
    ? SanitizedQuoteSummary
    : T extends OrderWithRelations
      ? SanitizedOrder
      : T;

export function sanitizePricingForNonAdmin<T extends SanitizableEntity>(
  entity: T,
  isAdmin = false,
): Sanitized<T> {
  if (isAdmin) return entity as unknown as Sanitized<T>;

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
      } as Sanitized<T>;
    }

    const { basePriceCents: _b, addonsTotalCents: _a, vendorTotalCents: _v, totalCents: _t, ...summary } =
      entity as QuoteSummaryWithRelations;
    return summary as Sanitized<T>;
  }

  if ('orderNumber' in entity) {
    const order = entity as OrderWithRelations;
    return {
      ...order,
      checklist: (order.checklist || []).map(({ addon, ...checklist }) => ({
        ...checklist,
        addon: addon ? (({ rateCents: _, ...addonRest }) => addonRest)(addon) : addon,
      })),
    } as Sanitized<T>;
  }

  return entity as Sanitized<T>;
}
