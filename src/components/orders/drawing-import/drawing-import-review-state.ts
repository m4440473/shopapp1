import type {
  DrawingImportFieldName,
  DrawingImportFieldValue,
  DrawingImportPageExtraction,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';

import type {
  DrawingImportJobSnapshot,
  DrawingImportReviewFilter,
  DrawingImportReviewPage,
  DrawingImportReviewState,
} from './drawing-import-ui.types';

const FIELD_NAMES: DrawingImportFieldName[] = [
  'partNumber',
  'partName',
  'drawingQuantity',
  'material',
  'finish',
  'stockSize',
  'cutLength',
  'finalLength',
  'partWidth',
  'partThickness',
  'revision',
  'assemblyStatus',
];

export function createDrawingImportReviewState(snapshot: DrawingImportJobSnapshot): DrawingImportReviewState {
  return { ...snapshot, dirtyFieldsByPage: {} };
}

function mergeExtractionPreservingDirtyFields(
  current: DrawingImportPageExtraction | null,
  incoming: DrawingImportPageExtraction | null,
  dirtyFields: ReadonlySet<DrawingImportFieldName>,
) {
  if (!incoming || !current || dirtyFields.size === 0) return incoming;
  const merged = { ...incoming };
  for (const field of FIELD_NAMES) {
    if (dirtyFields.has(field)) merged[field] = current[field] as never;
  }
  return merged;
}

/** Merge a polling snapshot without overwriting fields the administrator is editing. */
export function mergeDrawingImportJobSnapshot(
  current: DrawingImportReviewState,
  incoming: DrawingImportJobSnapshot,
): DrawingImportReviewState {
  const incomingById = new Map(incoming.pages.map((page) => [page.pageId, page]));
  const currentIds = new Set(current.pages.map((page) => page.pageId));
  const pages = current.pages.map((existing) => {
    const page = incomingById.get(existing.pageId);
    if (!page) return existing;
    const dirty = new Set(current.dirtyFieldsByPage[page.pageId] ?? []);
    return {
      ...page,
      extraction: mergeExtractionPreservingDirtyFields(existing.extraction, page.extraction, dirty),
    };
  });
  // Progressive endpoints may return only changed pages. Preserve every existing
  // page's position so saving one field cannot move that drawing to the top.
  pages.push(...incoming.pages.filter((page) => !currentIds.has(page.pageId)));
  const terminal = ['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED', 'COMPLETE'].includes(incoming.progress.status);
  const progress = !terminal && incoming.progress.completedPages < current.progress.completedPages
    ? current.progress
    : incoming.progress;
  return {
    progress,
    pages,
    supportingFiles: incoming.supportingFiles.length ? incoming.supportingFiles : current.supportingFiles,
    dirtyFieldsByPage: current.dirtyFieldsByPage,
  };
}

export function markDrawingImportFieldDirty(
  state: DrawingImportReviewState,
  pageId: string,
  field: DrawingImportFieldName,
): DrawingImportReviewState {
  return {
    ...state,
    dirtyFieldsByPage: {
      ...state.dirtyFieldsByPage,
      [pageId]: [...new Set([...(state.dirtyFieldsByPage[pageId] ?? []), field])],
    },
  };
}

export function clearDrawingImportFieldDirty(
  state: DrawingImportReviewState,
  pageId: string,
  field: DrawingImportFieldName,
): DrawingImportReviewState {
  const remaining = (state.dirtyFieldsByPage[pageId] ?? []).filter((candidate) => candidate !== field);
  const next = { ...state.dirtyFieldsByPage };
  if (remaining.length) next[pageId] = remaining;
  else delete next[pageId];
  return { ...state, dirtyFieldsByPage: next };
}

export function updateDrawingImportField(
  state: DrawingImportReviewState,
  pageId: string,
  field: DrawingImportFieldName,
  value: string | number | boolean | null,
): DrawingImportReviewState {
  const pages = state.pages.map((page) => {
    if (page.pageId !== pageId || !page.extraction) return page;
    return {
      ...page,
      extraction: {
        ...page.extraction,
        [field]: {
          ...page.extraction[field],
          value,
          status: 'human_corrected' as const,
        },
      },
    } as DrawingImportReviewPage;
  });
  return markDrawingImportFieldDirty({ ...state, pages }, pageId, field);
}

export function drawingImportFieldNeedsAttention(field: DrawingImportFieldName, value: DrawingImportFieldValue<string | number | boolean>) {
  // Missing revisions are normal. Preserve warnings for actual conflicting values.
  if (field === 'revision' && value.status !== 'conflicting' && (value.value === null || String(value.value).trim() === '')) return false;
  return ['not_present', 'unreadable', 'conflicting', 'tentative_filename_fallback'].includes(value.status);
}

function hasFieldStatus(page: DrawingImportReviewPage, status: 'not_present' | 'unreadable' | 'conflicting') {
  if (!page.extraction) return false;
  return FIELD_NAMES.some((field) => page.extraction?.[field].status === status && drawingImportFieldNeedsAttention(field, page.extraction[field]));
}

export function pageMatchesDrawingImportFilter(page: DrawingImportReviewPage, filter: DrawingImportReviewFilter) {
  switch (filter) {
    case 'all': return true;
    case 'missing': return hasFieldStatus(page, 'not_present');
    case 'unreadable': return hasFieldStatus(page, 'unreadable');
    case 'conflicting': return hasFieldStatus(page, 'conflicting');
    case 'uncertain': return page.classification === 'uncertain';
    case 'duplicate': return page.classification === 'duplicate';
    case 'failed': return page.processingStatus === 'failed';
  }
}

export function countDrawingImportFilters(pages: DrawingImportReviewPage[]) {
  const filters: DrawingImportReviewFilter[] = [
    'all', 'missing', 'unreadable', 'conflicting', 'uncertain', 'duplicate', 'failed',
  ];
  return Object.fromEntries(filters.map((filter) => [
    filter,
    pages.filter((page) => pageMatchesDrawingImportFilter(page, filter)).length,
  ])) as Record<DrawingImportReviewFilter, number>;
}

export type DrawingImportJobDraftContext = {
  destination: 'order' | 'quote';
  business: string;
  customerName: string;
  draftReference: string;
};

type JobDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function stableSegment(value: string) {
  return encodeURIComponent(value.trim().toLowerCase());
}

export function buildDrawingImportJobDraftKey(context: DrawingImportJobDraftContext) {
  return [
    'shopapp:drawing-import-job:v2',
    context.destination,
    stableSegment(context.business),
    stableSegment(context.customerName),
    stableSegment(context.draftReference),
  ].join(':');
}

export function readDrawingImportJobId(storage: JobDraftStorage, context: DrawingImportJobDraftContext) {
  try {
    const value = storage.getItem(buildDrawingImportJobDraftKey(context))?.trim() ?? '';
    return value || null;
  } catch {
    return null;
  }
}

export function writeDrawingImportJobId(storage: JobDraftStorage, context: DrawingImportJobDraftContext, jobId: string) {
  const normalized = jobId.trim();
  if (!normalized) throw new Error('A drawing import job ID is required.');
  storage.setItem(buildDrawingImportJobDraftKey(context), normalized);
}

export function clearDrawingImportJobId(storage: JobDraftStorage, context: DrawingImportJobDraftContext) {
  storage.removeItem(buildDrawingImportJobDraftKey(context));
}
