import { canDrawingImportPageCreatePart, drawingImportExtractionNeedsHumanReview } from './drawing-import-v2.mapping';
import { DRAWING_IMPORT_FIELD_NAMES, emptyDrawingField, normalizeDrawingImportPageExtraction, type DrawingImportPageExtraction } from './drawing-import-v2.types';

/** A human file-only decision asserts no drawing facts, including facts suggested by a filename. */
export function createFileOnlyDrawingExtraction(pageId: string): DrawingImportPageExtraction {
  return {
    schemaVersion: 'drawing-page-extraction-v4', pageId, classification: 'reference', route: 'human',
    classificationEvidence: [{ sourceType: 'human', sourcePageId: pageId, sourceRegion: null, sourceCropId: null,
      rawText: 'reference', parser: 'quote_review_v2', agreementSignals: [], warnings: [] }],
    partNumber: emptyDrawingField<string>('unreadable'), partName: emptyDrawingField<string>('unreadable'),
    drawingQuantity: emptyDrawingField<number>('unreadable'), material: emptyDrawingField<string>('unreadable'),
    finish: emptyDrawingField<string>('unreadable'), stockSize: emptyDrawingField<string>('unreadable'),
    cutLength: emptyDrawingField<string>('unreadable'), finalLength: emptyDrawingField<string>('unreadable'),
    partWidth: emptyDrawingField<string>('unreadable'), partThickness: emptyDrawingField<string>('unreadable'),
    revision: emptyDrawingField<string>('unreadable'), assemblyStatus: emptyDrawingField<boolean>('unreadable'),
    manufacturingNotes: [], autoAcceptedFields: [], warnings: ['No drawing facts were extracted. Saved as a file only.'],
  };
}

export function hasHumanDrawingClassification(extraction: DrawingImportPageExtraction) {
  // Older classification confirmations used route=human before explicit evidence.
  return extraction.route === 'human' || extraction.classificationEvidence.some((entry) => entry.sourceType === 'human');
}

/** Merge only protected decisions, never the stale copy of an unrelated field. */
export function preserveHumanDrawingReview(incoming: DrawingImportPageExtraction, saved: DrawingImportPageExtraction | null) {
  const merged = normalizeDrawingImportPageExtraction(structuredClone(incoming));
  if (!saved) return merged;
  for (const field of DRAWING_IMPORT_FIELD_NAMES) {
    if (saved[field]?.status === 'human_corrected') merged[field] = structuredClone(saved[field]) as never;
  }
  if (hasHumanDrawingClassification(saved)) {
    merged.classification = saved.classification;
    merged.classificationEvidence = structuredClone(saved.classificationEvidence);
    merged.route = 'human';
  }
  return merged;
}

export function drawingReviewStatus(extraction: DrawingImportPageExtraction) {
  return extraction.classification === 'uncertain'
    || (canDrawingImportPageCreatePart(extraction) && drawingImportExtractionNeedsHumanReview(extraction))
    ? 'MANUAL_REVIEW' : 'ACCEPTED';
}
