export type DrawingImportDraftContext = {
  destination: 'order' | 'quote';
  business: string;
  customerName: string;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function stableSegment(value: string) {
  return encodeURIComponent(value.trim().toLowerCase());
}

export function buildDrawingImportDraftStorageKey(context: DrawingImportDraftContext) {
  return [
    'shopapp:drawing-import:v2',
    context.destination,
    stableSegment(context.business),
    stableSegment(context.customerName),
  ].join(':');
}

export function readDrawingImportDraft(storage: DraftStorage, context: DrawingImportDraftContext): Record<string, unknown> | null {
  try {
    const stored = storage.getItem(buildDrawingImportDraftStorageKey(context));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDrawingImportDraft(storage: DraftStorage, context: DrawingImportDraftContext, draft: Record<string, unknown>) {
  storage.setItem(buildDrawingImportDraftStorageKey(context), JSON.stringify(draft));
}

export function clearDrawingImportDraft(storage: DraftStorage, context: DrawingImportDraftContext) {
  storage.removeItem(buildDrawingImportDraftStorageKey(context));
}
