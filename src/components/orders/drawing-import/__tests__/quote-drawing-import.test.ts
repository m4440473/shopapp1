import { describe, expect, it, vi } from 'vitest';

import type {
  DrawingImportFieldStatus,
  DrawingImportJobProgress,
  DrawingImportPageExtraction,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';
import { emptyDrawingField } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import { buildReviewedQuoteDrawingImport } from '../quote-drawing-import';
import { drawingImportFieldNeedsAttention, pageMatchesDrawingImportFilter } from '../drawing-import-review-state';
import { displayDrawingDimension, parseDrawingDimensionInput } from '../drawing-import-dimension-units';
import {
  canConfirmDrawingImportFieldValue,
  canCreateDrawingImportCatalogValue,
  shouldCommitDrawingImportFieldOnBlur,
  shouldShowDrawingImportConflictChoices,
} from '../DrawingImportFieldEditor';
import type {
  DrawingImportJobSnapshot,
  DrawingImportReviewPage,
  DrawingImportV2ApiClient,
} from '../drawing-import-ui.types';

function textField(value: string | null, status: DrawingImportFieldStatus = 'read') {
  return { ...emptyDrawingField<string>(), value, rawText: value, status };
}

function extraction(pageId: string): DrawingImportPageExtraction {
  return {
    schemaVersion: 'drawing-page-extraction-v2',
    pageId,
    classification: 'part_drawing',
    classificationEvidence: [],
    partNumber: textField('ABC-100'),
    partName: textField('Drive bracket'),
    drawingQuantity: { ...emptyDrawingField<number>(), value: 4, status: 'read' },
    material: textField('A36 steel'),
    finish: textField('Black oxide'),
    stockSize: textField('1/4 x 2 x 12'),
    cutLength: textField('12.125'),
    finalLength: textField('12'),
    partWidth: textField('2'),
    partThickness: textField('0.25'),
    revision: textField('B'),
    assemblyStatus: { ...emptyDrawingField<boolean>(), value: false, status: 'read' },
    route: 'local',
    autoAcceptedFields: ['partNumber', 'drawingQuantity'],
    warnings: [],
  };
}

function page(pageId = 'page-1'): DrawingImportReviewPage {
  return {
    pageId,
    filename: 'customer-packet.pdf',
    sourcePageNumber: 2,
    sourcePageCount: 5,
    classification: 'part_drawing',
    processingStatus: 'ready',
    extraction: extraction(pageId),
    exactPageHref: `/imports/page/${pageId}`,
    originalPacketHref: '/imports/packet/one',
    previewUrl: `/imports/preview/${pageId}`,
    canonicalSource: { storagePath: `quote/page-${pageId}.pdf`, label: `customer-packet.pdf — page 2 of 5`, mimeType: 'application/pdf' },
    originalPacketSource: { storagePath: 'quote/customer-packet.pdf', label: 'customer-packet.pdf', mimeType: 'application/pdf' },
    error: null,
    warnings: [],
  };
}

function progress(): DrawingImportJobProgress {
  return {
    jobId: 'job-1', status: 'READY_FOR_REVIEW', stage: 'ready_for_review', totalPages: 1,
    completedPages: 1, locallyAcceptedPages: 1, terraProcessedPages: 0, solEscalatedPages: 0,
    manualReviewPages: 0, failedPages: 0, estimatedCostUsd: 0, actualCostUsd: 0,
    elapsedMs: 200, firstPageReadyAt: new Date(0).toISOString(), errorSummary: null,
  };
}

describe('quote drawing V2 result mapping', () => {
  it('allows blank revision without attention, missing filters, or save blockers', () => {
    const reviewed = page('optional-revision');
    reviewed.extraction!.revision = textField(null, 'not_present');
    expect(drawingImportFieldNeedsAttention('revision', reviewed.extraction!.revision)).toBe(false);
    expect(pageMatchesDrawingImportFilter(reviewed, 'missing')).toBe(false);
    const result = buildReviewedQuoteDrawingImport([reviewed], [{ id: 'mat-a36', name: 'A36 Steel' }]);
    expect(result.blockingMessages).toEqual([]);
    expect(result.parts[0].revision).toBe('');
    expect(drawingImportFieldNeedsAttention('revision', textField('B', 'conflicting'))).toBe(true);
    expect(drawingImportFieldNeedsAttention('material', textField(null, 'not_present'))).toBe(true);
  });

  it('converts dimensions in both directions without rewriting stored values on toggles', () => {
    const stored = '1 1/2';
    for (let i = 0; i < 20; i++) {
      expect(displayDrawingDimension(stored, 'mm')).toBe('38.1');
      expect(displayDrawingDimension(stored, 'in')).toBe(stored);
    }
    expect(parseDrawingDimensionInput('50.8', 'mm')).toBe('2');
    expect(parseDrawingDimensionInput('1/8', 'in')).toBe('0.125');
    expect(parseDrawingDimensionInput('25.4 mm', 'in')).toBe('1');
    expect(parseDrawingDimensionInput('2"', 'mm')).toBe('2');
    for (const invalid of ['', 'abc', '1/0', '-2', '.', '10 cm']) expect(parseDrawingDimensionInput(invalid, 'mm')).toBeNull();
  });

  it('saves metric edits in inches and retains the exact imperial saw allowance', () => {
    const reviewed = page('metric-edit');
    reviewed.extraction!.finalLength = textField(parseDrawingDimensionInput('101.6', 'mm'), 'human_corrected');
    reviewed.extraction!.partWidth = textField(parseDrawingDimensionInput('50.8', 'mm'), 'human_corrected');
    reviewed.extraction!.partThickness = textField(parseDrawingDimensionInput('3.175', 'mm'), 'human_corrected');
    const result = buildReviewedQuoteDrawingImport([reviewed], [{ id: 'mat-a36', name: 'A36 Steel' }]);
    expect(result.blockingMessages).toEqual([]);
    expect(result.parts[0]).toMatchObject({ finalPartLength: '4', partWidth: '2', partThickness: '0.125', cutLength: '4.125', stockSize: '0.125 × 2 × 16.5' });
    expect(displayDrawingDimension(result.parts[0].cutLength, 'mm')).toBe('104.775');
  });

  it('uses finished length plus 0.125 inch per part and multiplies by the reviewed quantity', () => {
    const reviewed = page('shop-math');
    reviewed.extraction!.finalLength = textField('4');
    reviewed.extraction!.drawingQuantity = { ...emptyDrawingField<number>(), value: 3, status: 'human_corrected' };
    reviewed.extraction!.cutLength = textField('999');
    reviewed.extraction!.stockSize = textField('AI SHOULD NOT CONTROL THIS');

    const result = buildReviewedQuoteDrawingImport([reviewed], [{ id: 'mat-a36', name: 'A36 Steel' }]);

    expect(result.blockingMessages).toEqual([]);
    expect(result.parts[0]).toMatchObject({
      quantity: 3,
      finalPartLength: '4',
      cutLength: '4.125',
      stockSize: '0.25 × 2 × 12.375',
    });
  });

  it('offers catalog creation only for the material field', () => {
    expect(canCreateDrawingImportCatalogValue('material')).toBe(true);
    expect(canCreateDrawingImportCatalogValue('partName')).toBe(false);
    expect(canCreateDrawingImportCatalogValue('finish')).toBe(false);
    expect(canCreateDrawingImportCatalogValue('partWidth')).toBe(false);
  });

  it('allows a detected value to be explicitly confirmed but requires missing values to be entered', () => {
    expect(canConfirmDrawingImportFieldValue(textField('4', 'unreadable'))).toBe(true);
    expect(canConfirmDrawingImportFieldValue(textField(null, 'not_present'))).toBe(false);
  });

  it('does not turn weak provenance candidates into extra confirmation decisions', () => {
    const resolved = textField('26031-00-133-604');
    resolved.candidates = [
      { value: 'SHEET', sourceType: 'embedded_text', sourcePageId: 'page-1', sourceRegion: null, rawText: 'DRAWING NUMBER SHEET B' },
      { value: '26031-00-133-604', sourceType: 'model_full_page', sourcePageId: 'page-1', sourceRegion: null, rawText: '26031-00-133-604' },
    ];
    expect(shouldShowDrawingImportConflictChoices(resolved)).toBe(false);

    resolved.status = 'conflicting';
    expect(shouldShowDrawingImportConflictChoices(resolved)).toBe(true);
  });

  it('does not confirm an untouched field merely because the explanation was opened', () => {
    expect(shouldCommitDrawingImportFieldOnBlur(false)).toBe(false);
    expect(shouldCommitDrawingImportFieldOnBlur(true)).toBe(true);
  });

  it('maps reviewed page values and keeps one original packet attachment', () => {
    const first = page('page-1');
    const second = { ...page('page-2'), sourcePageNumber: 3 };
    const result = buildReviewedQuoteDrawingImport([first, second], [{ id: 'mat-a36', name: 'A36 Steel' }]);

    expect(result.blockingMessages).toEqual([]);
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toMatchObject({
      importPageId: 'page-1', partNumber: 'ABC-100', quantity: 4, materialId: 'mat-a36', revision: 'B',
      finalPartLength: '12', partWidth: '2', partThickness: '0.25', cutLength: '12.125',
      stockSize: '0.25 × 2 × 48.5',
      source: { storagePath: 'quote/page-page-1.pdf' },
    });
    expect(result.files).toEqual([{ storagePath: 'quote/customer-packet.pdf', label: 'customer-packet.pdf', mimeType: 'application/pdf' }]);
  });

  it('returns drawing manufacturing notes as explicit, source-linked suggestions', () => {
    const reviewed = page('note-page');
    reviewed.extraction!.manufacturingNotes = [{
      text: 'PREHEAT TO 600-700F',
      category: 'preheat_heat_treat',
      evidence: [{
        sourceType: 'model_full_page', sourcePageId: 'note-page', sourceRegion: [0.1, 0.2, 0.4, 0.3],
        sourceCropId: null, rawText: 'PREHEAT TO 600-700F', parser: 'drawing-import-ai-terra_full_page',
        agreementSignals: ['mapped_to_local_text'], warnings: [],
      }],
      warnings: [], diagnosticConfidence: 0.9,
    }];
    const result = buildReviewedQuoteDrawingImport([reviewed], [{ id: 'mat-a36', name: 'A36 Steel' }]);
    expect(result.parts[0].noteSuggestions).toEqual([expect.objectContaining({
      text: 'PREHEAT TO 600-700F',
      destination: 'workInstructions',
      evidenceHref: '/imports/page/note-page',
      evidenceQuality: 'mapped_region',
      requiresDrawingReview: true,
    })]);
  });

  it('blocks uncertain pages and unmatched materials instead of guessing', () => {
    const uncertain = { ...page('uncertain'), classification: 'uncertain' as const };
    const unmatched = page('unmatched');
    const result = buildReviewedQuoteDrawingImport([uncertain, unmatched], []);

    expect(result.blockingMessages).toEqual(expect.arrayContaining([
      expect.stringContaining('page-type decision'),
      expect.stringContaining('not matched to the catalog'),
    ]));
  });

  it('keeps a reference page file without creating a quote part', () => {
    const fileOnly = { ...page('file-only'), classification: 'reference' as const };
    const result = buildReviewedQuoteDrawingImport([fileOnly], [{ id: 'mat-a36', name: 'A36 Steel' }]);

    expect(result.parts).toEqual([]);
    expect(result.files).toEqual([{ storagePath: 'quote/customer-packet.pdf', label: 'customer-packet.pdf', mimeType: 'application/pdf' }]);
    expect(result.blockingMessages).toContain('No reviewed part drawings are ready to add to this quote.');
  });

  it('does not require field approval after a page is explicitly kept as a file only', () => {
    const fileOnly = {
      ...page('file-only-failed'),
      classification: 'reference' as const,
      processingStatus: 'failed' as const,
      extraction: null,
    };
    const validPart = page('valid-part');
    const result = buildReviewedQuoteDrawingImport([fileOnly, validPart], [{ id: 'mat-a36', name: 'A36 Steel' }]);

    expect(result.parts).toHaveLength(1);
    expect(result.blockingMessages).toEqual([]);
    expect(result.files).toEqual([{ storagePath: 'quote/customer-packet.pdf', label: 'customer-packet.pdf', mimeType: 'application/pdf' }]);
  });

  it('does not silently save a detail drawing with missing manufacturing dimensions', () => {
    const missing = page('missing-dimensions');
    missing.extraction!.partThickness = textField(null, 'not_present');
    const result = buildReviewedQuoteDrawingImport([missing], [{ id: 'mat-a36', name: 'A36 Steel' }]);

    expect(result.blockingMessages).toContain('customer-packet.pdf, page 2: partThickness requires confirmation.');
  });
});

describe('quote Drawing Import V2 API contract', () => {
  it('supports feature check, upload, polling, correction, retry, and cancellation through a mock client', async () => {
    const snapshot: DrawingImportJobSnapshot = { progress: progress(), pages: [page()], supportingFiles: [] };
    const api: DrawingImportV2ApiClient = {
      getFeatureStatus: vi.fn().mockResolvedValue({ enabled: true, mode: 'admin_beta', version: 'V3', reason: null }),
      startQuoteImport: vi.fn().mockResolvedValue(snapshot),
      getJob: vi.fn().mockResolvedValue(snapshot),
      cancelJob: vi.fn().mockResolvedValue(snapshot),
      reprocessPage: vi.fn().mockResolvedValue(snapshot),
      saveCorrection: vi.fn().mockResolvedValue(page()),
      saveClassification: vi.fn().mockResolvedValue(page()),
    };

    await expect(api.getFeatureStatus()).resolves.toMatchObject({ enabled: true });
    const upload = new File([Buffer.from('%PDF-1.4')], 'packet.pdf', { type: 'application/pdf' });
    await expect(api.startQuoteImport({
      file: upload,
      business: 'Sterling Tool and Die',
      customerName: 'Toyota',
      draftReference: 'draft-1',
      intakeMode: 'ASSEMBLY',
      assemblyMultiplier: 3,
    })).resolves.toBe(snapshot);
    await expect(api.getJob('job-1')).resolves.toBe(snapshot);
    await expect(api.saveCorrection({ jobId: 'job-1', pageId: 'page-1', field: 'partNumber', value: 'ABC-200' })).resolves.toMatchObject({ pageId: 'page-1' });
    await expect(api.reprocessPage('job-1', 'page-1')).resolves.toBe(snapshot);
    await expect(api.saveClassification({ jobId: 'job-1', pageId: 'page-1', classification: 'part_drawing' })).resolves.toMatchObject({ pageId: 'page-1' });
    await expect(api.cancelJob('job-1')).resolves.toBe(snapshot);
    expect(api.startQuoteImport).toHaveBeenCalledWith(expect.objectContaining({ intakeMode: 'ASSEMBLY', assemblyMultiplier: 3 }));
    expect(api.getJob).toHaveBeenCalledWith('job-1');
  });
});
