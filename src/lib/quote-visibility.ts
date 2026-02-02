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

const RESTRICTED_ATTACHMENT_LABELS = ['quote', 'po', 'purchase order', 'invoice'];

function matchesRestrictedAttachmentLabel(label?: string | null) {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return RESTRICTED_ATTACHMENT_LABELS.some((keyword) => normalized.includes(keyword));
}

function isRestrictedPartAttachment(attachment: any) {
  if (!attachment) return false;
  const kind = typeof attachment.kind === 'string' ? attachment.kind.toUpperCase() : '';
  if (kind === 'PO') return true;
  return matchesRestrictedAttachmentLabel(attachment.label);
}

function isRestrictedOrderAttachment(attachment: any) {
  if (!attachment) return false;
  return matchesRestrictedAttachmentLabel(attachment.label);
}

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
        attachments: (part.attachments || []).filter((attachment: any) => !isRestrictedPartAttachment(attachment)),
      })),
      charges: (order.charges || []).map(({ unitPrice: _, ...charge }) => charge),
      partAttachments: (order as any).partAttachments
        ? (order as any).partAttachments.filter((attachment: any) => !isRestrictedPartAttachment(attachment))
        : (order as any).partAttachments,
      attachments: (order.attachments || []).filter((attachment: any) => !isRestrictedOrderAttachment(attachment)),
    };
  }

  return entity;
}
