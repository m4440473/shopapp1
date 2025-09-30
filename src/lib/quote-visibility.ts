import type { Prisma } from '@prisma/client';

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

export function sanitizeQuoteDetailPricing(
  quote: QuoteDetailWithRelations,
  isAdmin: boolean,
): QuoteDetailWithRelations {
  if (isAdmin) return quote;

  return {
    ...quote,
    basePriceCents: 0,
    addonsTotalCents: 0,
    vendorTotalCents: 0,
    totalCents: 0,
    vendorItems: quote.vendorItems.map((item) => ({
      ...item,
      basePriceCents: 0,
      finalPriceCents: 0,
    })),
    addonSelections: quote.addonSelections.map((selection) => ({
      ...selection,
      rateCents: 0,
      totalCents: 0,
      addon: selection.addon
        ? {
            ...selection.addon,
            rateCents: 0,
          }
        : selection.addon,
    })),
  };
}

export function sanitizeQuoteSummaryPricing(
  quote: QuoteSummaryWithRelations,
  isAdmin: boolean,
): QuoteSummaryWithRelations {
  if (isAdmin) return quote;

  return {
    ...quote,
    basePriceCents: 0,
    addonsTotalCents: 0,
    vendorTotalCents: 0,
    totalCents: 0,
  };
}
