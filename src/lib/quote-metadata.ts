export interface QuoteApprovalMetadata {
  received: boolean;
  attachmentId: string | null;
  attachmentLabel?: string | null;
  attachmentStoragePath?: string | null;
  attachmentUrl?: string | null;
  uploadedAt?: string | null;
}

export interface QuoteConversionMetadata {
  orderId: string | null;
  orderNumber: string | null;
  convertedAt?: string | null;
}

export type QuotePartPricingEntry = {
  name?: string | null;
  partNumber?: string | null;
  priceCents: number;
};

export type QuoteMetadata = Record<string, unknown> & {
  markupSuggestions?: number[];
  approval?: QuoteApprovalMetadata;
  conversion?: QuoteConversionMetadata;
  partPricing?: QuotePartPricingEntry[];
};

const DEFAULT_APPROVAL: QuoteApprovalMetadata = {
  received: false,
  attachmentId: null,
  attachmentLabel: null,
  attachmentStoragePath: null,
  attachmentUrl: null,
  uploadedAt: null,
};

const DEFAULT_CONVERSION: QuoteConversionMetadata = {
  orderId: null,
  orderNumber: null,
  convertedAt: null,
};

export const DEFAULT_QUOTE_METADATA: QuoteMetadata = Object.freeze({
  markupSuggestions: [0.1, 0.15, 0.2],
  approval: DEFAULT_APPROVAL,
  conversion: DEFAULT_CONVERSION,
});

function cloneDefaultArray(values: number[] | undefined): number[] | undefined {
  if (!values) return undefined;
  return values.slice();
}

function clonePartPricing(values: QuotePartPricingEntry[] | undefined): QuotePartPricingEntry[] | undefined {
  if (!values) return undefined;
  return values.map((entry) => ({ ...entry }));
}

export function mergeQuoteMetadata(metadata: QuoteMetadata | null | undefined): QuoteMetadata {
  const base = metadata && typeof metadata === 'object' ? metadata : {};
  const approval =
    base.approval && typeof base.approval === 'object'
      ? { ...DEFAULT_APPROVAL, ...base.approval }
      : { ...DEFAULT_APPROVAL };
  const conversion =
    base.conversion && typeof base.conversion === 'object'
      ? { ...DEFAULT_CONVERSION, ...base.conversion }
      : { ...DEFAULT_CONVERSION };

  return {
    ...base,
    markupSuggestions: Array.isArray(base.markupSuggestions)
      ? cloneDefaultArray(base.markupSuggestions) ?? cloneDefaultArray(DEFAULT_QUOTE_METADATA.markupSuggestions)
      : cloneDefaultArray(DEFAULT_QUOTE_METADATA.markupSuggestions),
    approval,
    conversion,
    partPricing: Array.isArray(base.partPricing) ? clonePartPricing(base.partPricing) : undefined,
  } satisfies QuoteMetadata;
}

export function stringifyQuoteMetadata(metadata: QuoteMetadata | null | undefined): string | null {
  const merged = mergeQuoteMetadata(metadata ?? DEFAULT_QUOTE_METADATA);

  try {
    return JSON.stringify(merged);
  } catch {
    return null;
  }
}

export function parseQuoteMetadata(value: string | null | undefined): QuoteMetadata | null {
  if (!value) {
    return mergeQuoteMetadata(DEFAULT_QUOTE_METADATA);
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? mergeQuoteMetadata(parsed as QuoteMetadata) : mergeQuoteMetadata(DEFAULT_QUOTE_METADATA);
  } catch {
    return mergeQuoteMetadata(DEFAULT_QUOTE_METADATA);
  }
}
