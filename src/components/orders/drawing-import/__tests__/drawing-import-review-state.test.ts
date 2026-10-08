import { describe, expect, it } from 'vitest';

import type {
  DrawingImportFieldStatus,
  DrawingImportJobProgress,
  DrawingImportPageExtraction,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';
import { emptyDrawingField } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import {
  buildDrawingImportJobDraftKey,
  acknowledgeDrawingImportFieldSave,
  acknowledgeDrawingImportClassificationSave,
  clearDrawingImportFieldDirty,
  clearDrawingImportJobId,
  countDrawingImportFilters,
  createDrawingImportReviewState,
  drawingImportCanReview,
  drawingImportCanKeepFileOnly,
  drawingImportCanTransferToDraft,
  drawingImportHasUnsavedChanges,
  markDrawingImportFieldDirty,
  mergeDrawingImportJobSnapshot,
  pageMatchesDrawingImportFilter,
  readDrawingImportJobId,
  writeDrawingImportJobId,
  updateDrawingImportField,
} from '../drawing-import-review-state';
import type { DrawingImportJobSnapshot, DrawingImportReviewPage } from '../drawing-import-ui.types';

function field(value: string | null, status: DrawingImportFieldStatus = 'read') {
  return {
    ...emptyDrawingField<string>(),
    value,
    rawText: value,
    status,
  };
}

function extraction(pageId: string, partNumber = 'OLD-100'): DrawingImportPageExtraction {
  return {
    schemaVersion: 'drawing-page-extraction-v2',
    pageId,
    classification: 'part_drawing',
    classificationEvidence: [],
    partNumber: field(partNumber),
    partName: field('Bracket'),
    drawingQuantity: { ...emptyDrawingField<number>(), value: 2, status: 'read' },
    material: field('A36'),
    finish: field(null, 'not_present'),
    stockSize: field(null, 'not_present'),
    cutLength: field(null, 'not_present'),
    finalLength: field(null, 'unreadable'),
    partWidth: field(null, 'not_present'),
    partThickness: field(null, 'not_present'),
    revision: field('A'),
    assemblyStatus: { ...emptyDrawingField<boolean>(), value: false, status: 'read' },
    route: 'local',
    autoAcceptedFields: ['partNumber'],
    warnings: [],
  };
}

function page(pageId = 'page-1'): DrawingImportReviewPage {
  return {
    pageId,
    filename: 'packet.pdf',
    sourcePageNumber: 1,
    sourcePageCount: 2,
    classification: 'part_drawing',
    processingStatus: 'ready',
    extraction: extraction(pageId),
    exactPageHref: `/page/${pageId}`,
    originalPacketHref: '/packet',
    previewUrl: `/preview/${pageId}`,
    canonicalSource: { storagePath: `pages/${pageId}.pdf`, label: `${pageId}.pdf`, mimeType: 'application/pdf' },
    originalPacketSource: { storagePath: 'packets/packet.pdf', label: 'packet.pdf', mimeType: 'application/pdf' },
    error: null,
    warnings: [],
  };
}

function progress(completedPages = 1): DrawingImportJobProgress {
  return {
    jobId: 'job-1',
    status: 'PROCESSING',
    stage: 'ai_resolution',
    totalPages: 2,
    completedPages,
    locallyAcceptedPages: 1,
    terraProcessedPages: 0,
    solEscalatedPages: 0,
    manualReviewPages: 0,
    failedPages: 0,
    estimatedCostUsd: 0.1,
    actualCostUsd: 0,
    elapsedMs: 1000,
    firstPageReadyAt: null,
    errorSummary: null,
  };
}

describe('drawing import polling state', () => {
  it('allows explicit file-only recovery for stopped jobs while keeping editing and undecided transfer locked', () => {
    const stopped = createDrawingImportReviewState({ progress: { ...progress(), status: 'FAILED' }, pages: [{ ...page(), classification: 'uncertain', processingStatus: 'failed', extraction: null }], supportingFiles: [] });
    expect(drawingImportCanReview(stopped)).toBe(false);
    expect(drawingImportCanKeepFileOnly(stopped)).toBe(true);
    expect(drawingImportCanTransferToDraft(stopped)).toBe(false);
    const kept = { ...stopped, pages: [{ ...stopped.pages[0], classification: 'reference' as const }] };
    expect(drawingImportCanTransferToDraft(kept)).toBe(true);
    expect(drawingImportCanReview(kept)).toBe(false);
    expect(drawingImportCanKeepFileOnly({ ...kept, progress: { ...kept.progress, status: 'PROCESSING' } })).toBe(false);
    expect(drawingImportCanTransferToDraft({ ...kept, progress: { ...kept.progress, status: 'CANCELLED' } })).toBe(true);
  });

  it('keeps the last saved confirmation when an older poll still has the AI result', () => {
    const reviewed = page();
    reviewed.extraction!.partNumber = field('CONFIRMED-42', 'human_corrected');
    const state = createDrawingImportReviewState({ progress: progress(), pages: [reviewed], supportingFiles: [] });
    const merged = mergeDrawingImportJobSnapshot(state, { progress: progress(), pages: [page()], supportingFiles: [] });
    expect(merged.pages[0].extraction!.partNumber.value).toBe('CONFIRMED-42');
    expect(merged.dirtyFieldsByPage).toEqual({});
  });

  it('does not clear newer typing when an earlier correction finishes saving', () => {
    let state = createDrawingImportReviewState({ progress: progress(), pages: [page()], supportingFiles: [] });
    state = updateDrawingImportField(state, 'page-1', 'partNumber', 'FIRST');
    const input = { jobId: 'job-1', pageId: 'page-1', field: 'partNumber' as const, value: 'FIRST' };
    state = updateDrawingImportField(state, 'page-1', 'partNumber', 'SECOND');
    const saved = page();
    saved.extraction!.partNumber = field('FIRST', 'human_corrected');
    const merged = acknowledgeDrawingImportFieldSave(state, input, saved);
    expect(merged.pages[0].extraction!.partNumber.value).toBe('SECOND');
    expect(merged.dirtyFieldsByPage['page-1']).toContain('partNumber');
  });

  it('acknowledges only the submitted field when two different saves return stale page snapshots', () => {
    let state = createDrawingImportReviewState({ progress: progress(), pages: [page()], supportingFiles: [] });
    state = updateDrawingImportField(state, 'page-1', 'partNumber', 'HUMAN-42');
    state = updateDrawingImportField(state, 'page-1', 'material', 'Stainless');
    const partSaved = page();
    partSaved.extraction!.partNumber = field('HUMAN-42', 'human_corrected');
    const materialSaved = page();
    materialSaved.extraction!.material = field('Stainless', 'human_corrected');
    state = acknowledgeDrawingImportFieldSave(state, { jobId: 'job-1', pageId: 'page-1', field: 'partNumber', value: 'HUMAN-42' }, partSaved);
    state = acknowledgeDrawingImportFieldSave(state, { jobId: 'job-1', pageId: 'page-1', field: 'material', value: 'Stainless' }, materialSaved);
    expect(state.pages[0].extraction!.partNumber.value).toBe('HUMAN-42');
    expect(state.pages[0].extraction!.material.value).toBe('Stainless');
    expect(drawingImportHasUnsavedChanges(state)).toBe(false);
  });

  it('keeps the saved page-type decision through an older poll', () => {
    const state = createDrawingImportReviewState({ progress: progress(), pages: [page()], supportingFiles: [] });
    const saved = { ...page(), classification: 'reference' as const };
    const acknowledged = acknowledgeDrawingImportClassificationSave(state, saved);
    const merged = mergeDrawingImportJobSnapshot(acknowledged, { progress: progress(), pages: [page()], supportingFiles: [] });
    expect(merged.pages[0].classification).toBe('reference');
  });

  it('holds review until finalization ends and also locks it for a page retry', () => {
    const state = createDrawingImportReviewState({ progress: progress(2), pages: [page()], supportingFiles: [] });
    expect(drawingImportCanReview(state)).toBe(false);
    const ready = { ...state, progress: { ...state.progress, status: 'READY_FOR_REVIEW' as const } };
    expect(drawingImportCanReview(ready)).toBe(true);
    expect(drawingImportCanReview({ ...ready, pages: [{ ...page(), processingStatus: 'queued' }] })).toBe(false);
    expect(drawingImportCanReview({ ...ready, progress: { ...ready.progress, status: 'CANCELLED' } })).toBe(false);
    expect(drawingImportCanReview({ ...ready, progress: { ...ready.progress, status: 'PARTIAL_FAILURE' } })).toBe(true);
  });

  it('resumes polling for a page-only retry without clearing other pages or their unsaved edits', () => {
    const other = page('page-2');
    let state = createDrawingImportReviewState({ progress: { ...progress(2), status: 'READY_FOR_REVIEW' }, pages: [page(), other], supportingFiles: [] });
    state = markDrawingImportFieldDirty(state, 'page-2', 'material');
    state.pages[1].extraction!.material = field('Human material', 'human_corrected');
    const queued = { ...page(), processingStatus: 'queued' as const };
    const merged = mergeDrawingImportJobSnapshot(state, { progress: { ...progress(1), status: 'QUEUED' }, pages: [queued], supportingFiles: [] });
    expect(merged.progress.status).toBe('QUEUED');
    expect(merged.progress.completedPages).toBe(1);
    expect(merged.pages.map((entry) => entry.pageId)).toEqual(['page-1', 'page-2']);
    expect(merged.pages[1]).toBe(other);
    expect(merged.pages[1].extraction!.material.value).toBe('Human material');
    expect(merged.dirtyFieldsByPage['page-2']).toContain('material');
  });

  it('merges newer polling data without overwriting a dirty human edit', () => {
    let state = createDrawingImportReviewState({ progress: progress(), pages: [page()], supportingFiles: [] });
    state.pages[0] = {
      ...state.pages[0],
      extraction: { ...state.pages[0].extraction!, partNumber: field('HUMAN-9', 'human_corrected') },
    };
    state = markDrawingImportFieldDirty(state, 'page-1', 'partNumber');

    const incomingPage = page();
    incomingPage.extraction = {
      ...incomingPage.extraction!,
      partNumber: field('MODEL-200'),
      revision: field('B'),
    };
    const merged = mergeDrawingImportJobSnapshot(state, {
      progress: progress(2),
      pages: [incomingPage],
      supportingFiles: [],
    });

    expect(merged.progress.completedPages).toBe(2);
    expect(merged.pages[0].extraction?.partNumber.value).toBe('HUMAN-9');
    expect(merged.pages[0].extraction?.revision.value).toBe('B');
  });

  it('clears a committed field so a later server result can replace it', () => {
    let state = createDrawingImportReviewState({ progress: progress(), pages: [page()], supportingFiles: [] });
    state = markDrawingImportFieldDirty(state, 'page-1', 'partNumber');
    state = clearDrawingImportFieldDirty(state, 'page-1', 'partNumber');
    const incoming = page();
    incoming.extraction = { ...incoming.extraction!, partNumber: field('SERVER-3') };

    expect(mergeDrawingImportJobSnapshot(state, { progress: progress(), pages: [incoming], supportingFiles: [] }).pages[0].extraction?.partNumber.value).toBe('SERVER-3');
  });

  it('preserves pages omitted from an incremental poll and ignores stale progress', () => {
    const state = createDrawingImportReviewState({
      progress: progress(2),
      pages: [page('page-1'), page('page-2')],
      supportingFiles: [],
    });
    const merged = mergeDrawingImportJobSnapshot(state, {
      progress: progress(1),
      pages: [page('page-2')],
      supportingFiles: [],
    });

    expect(merged.pages.map((entry) => entry.pageId).sort()).toEqual(['page-1', 'page-2']);
    expect(merged.progress.completedPages).toBe(2);
  });

  it('keeps page order stable when a one-page correction snapshot arrives', () => {
    const state = createDrawingImportReviewState({
      progress: progress(2),
      pages: [page('page-1'), page('page-2'), page('page-3')],
      supportingFiles: [],
    });
    const corrected = page('page-3');
    corrected.extraction = { ...corrected.extraction!, partNumber: field('CORRECTED-3', 'human_corrected') };

    const merged = mergeDrawingImportJobSnapshot(state, {
      progress: progress(2),
      pages: [corrected],
      supportingFiles: [],
    });

    expect(merged.pages.map((entry) => entry.pageId)).toEqual(['page-1', 'page-2', 'page-3']);
    expect(merged.pages[2].extraction?.partNumber.value).toBe('CORRECTED-3');
  });
});

describe('drawing import review filters', () => {
  it('counts field problems and page classifications independently', () => {
    const missing = page('missing');
    const duplicate = { ...page('duplicate'), classification: 'duplicate' as const };
    const failed = { ...page('failed'), processingStatus: 'failed' as const, error: 'Timed out' };
    const pages = [missing, duplicate, failed];
    const counts = countDrawingImportFilters(pages);

    expect(counts.all).toBe(3);
    expect(counts.missing).toBe(3);
    expect(counts.unreadable).toBe(3);
    expect(counts.duplicate).toBe(1);
    expect(counts.failed).toBe(1);
    expect(pageMatchesDrawingImportFilter(duplicate, 'duplicate')).toBe(true);
  });
});

describe('drawing import job draft identity', () => {
  const context = {
    destination: 'order' as const,
    business: 'C & R',
    customerName: 'Toyota',
    draftReference: 'draft-100',
  };

  function storage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
  }

  it('includes the draft reference so two imports for one customer cannot collide', () => {
    expect(buildDrawingImportJobDraftKey(context)).not.toBe(buildDrawingImportJobDraftKey({ ...context, draftReference: 'draft-200' }));
  });

  it('round-trips and clears only the active durable job ID', () => {
    const target = storage();
    writeDrawingImportJobId(target, context, ' job-42 ');
    expect(readDrawingImportJobId(target, context)).toBe('job-42');
    clearDrawingImportJobId(target, context);
    expect(readDrawingImportJobId(target, context)).toBeNull();
  });
});
