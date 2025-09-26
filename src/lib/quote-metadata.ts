export type QuoteMetadata = Record<string, unknown> & {
  markupSuggestions?: number[];
};

export const DEFAULT_QUOTE_METADATA: QuoteMetadata = Object.freeze({
  markupSuggestions: [0.1, 0.15, 0.2],
});

export function stringifyQuoteMetadata(metadata: QuoteMetadata | null | undefined): string | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

export function parseQuoteMetadata(value: string | null | undefined): QuoteMetadata | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as QuoteMetadata) : null;
  } catch {
    return null;
  }
}
