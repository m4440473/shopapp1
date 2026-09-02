import { describe, expect, it } from 'vitest';

import { DrawingImportAiExtraction } from '../ai/drawing-import-ai.schema';
import { hasOnlyKnownRegionIdentities } from '../ai/drawing-import-ai.adapter';
import { mergeDrawingImportAiExtraction } from '../drawing-import-v2.mapping';
import { DRAWING_IMPORT_FIELD_NAMES, emptyDrawingField, normalizeDrawingImportPageExtraction, type DrawingImportPageExtraction } from '../drawing-import-v2.types';

function aiExtraction(noteRegion: string | null = null) {
  const field = { value: null, rawText: null, status: 'not_present' as const, evidenceText: null, sourceRegionIdentity: null, warnings: [], diagnosticConfidence: null };
  return {
    classification: 'part_drawing' as const,
    classificationEvidenceText: 'detail drawing',
    ...Object.fromEntries(DRAWING_IMPORT_FIELD_NAMES.map((name) => [name, name === 'drawingQuantity' ? { ...field, value: 1, rawText: '1', status: 'read', evidenceText: 'QTY 1' } : name === 'assemblyStatus' ? { ...field, value: false } : { ...field }])),
    manufacturingNotes: [{ text: 'PREHEAT TO 600-700F', category: 'preheat_heat_treat' as const, evidenceText: 'PREHEAT TO 600-700F', sourceRegionIdentity: noteRegion, warnings: [], diagnosticConfidence: 0.92 }],
    contradictions: [],
    warnings: [],
  } as unknown as DrawingImportAiExtraction;
}

function local(): DrawingImportPageExtraction {
  const extraction = Object.fromEntries(DRAWING_IMPORT_FIELD_NAMES.map((name) => [name, name === 'drawingQuantity' ? { ...emptyDrawingField<number>(), value: 1, rawText: '1', status: 'read' } : name === 'assemblyStatus' ? { ...emptyDrawingField<boolean>(), value: false, rawText: 'false', status: 'read' } : emptyDrawingField<string>()]));
  return { schemaVersion: 'drawing-page-extraction-v3', pageId: 'page-1', classification: 'part_drawing', classificationEvidence: [], ...extraction, route: 'local', autoAcceptedFields: [], warnings: [] } as DrawingImportPageExtraction;
}

describe('manufacturing drawing note contract', () => {
  it('defaults historical extraction JSON to an empty note collection', () => {
    expect(normalizeDrawingImportPageExtraction(local()).manufacturingNotes).toEqual([]);
  });

  it('requires exact evidence text and rejects an invented region identity', () => {
    expect(DrawingImportAiExtraction.safeParse(aiExtraction()).success).toBe(true);
    expect(hasOnlyKnownRegionIdentities(aiExtraction('invented-region'), [])).toBe(false);
    expect(hasOnlyKnownRegionIdentities(aiExtraction('known-region'), ['known-region'])).toBe(true);
  });

  it('maps typed note evidence and preserves it through dimension-only refinement', () => {
    const first = mergeDrawingImportAiExtraction({
      local: local(), ai: aiExtraction(), route: 'terra_full_page',
      page: {
        pageNumber: 1,
        pageWidth: 100,
        pageHeight: 100,
        pageRotation: 0,
        rawText: 'PREHEAT TO 600-700F',
        spans: [],
        extractionMethod: 'embedded_text',
        lines: [{ text: 'PREHEAT TO 600-700F', normalizedText: 'PREHEAT TO 600-700F', region: [0.1, 0.2, 0.5, 0.3], spanReadingOrders: [], rotationDegrees: 0 }],
      },
    });
    expect(first.manufacturingNotes).toEqual([expect.objectContaining({
      text: 'PREHEAT TO 600-700F', evidence: [expect.objectContaining({ sourceRegion: [0.1, 0.2, 0.5, 0.3] })],
    })]);
    const refinement = { ...aiExtraction(), manufacturingNotes: [] };
    const refined = mergeDrawingImportAiExtraction({
      local: first, ai: refinement, route: 'terra_refinement', fieldsToReplace: ['finalLength'],
      page: { pageNumber: 1, pageWidth: 100, pageHeight: 100, pageRotation: 0, rawText: '', spans: [], lines: [], extractionMethod: 'embedded_text' },
    });
    expect(refined.manufacturingNotes).toEqual(first.manufacturingNotes);
  });
});
