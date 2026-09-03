import { describe, expect, it } from 'vitest';
import type { DrawingImportAiExtraction } from '../ai/drawing-import-ai.schema';
import { mergeDrawingImportAiExtraction } from '../drawing-import-v2.mapping';
import { DRAWING_IMPORT_FIELD_NAMES, emptyDrawingField, type DrawingImportFieldValue, type DrawingImportPageExtraction } from '../drawing-import-v2.types';
import type { CoordinateAwarePageText } from '../document';

function localField<T extends string | number | boolean>(value: T, rawText = String(value)): DrawingImportFieldValue<T> {
  return { value, rawText, status: 'read', evidence: [{ sourceType: 'embedded_text', sourcePageId: 'page-1', sourceRegion: [0, 0, 1, 1], sourceCropId: null, rawText, parser: 'test', agreementSignals: [], warnings: [] }], candidates: [], warnings: [], diagnosticConfidence: null };
}
function aiField<T extends string | number | boolean>(value: T | null) {
  return { value, rawText: value === null ? null : String(value), status: value === null ? 'not_present' as const : 'read' as const, evidenceText: value === null ? null : String(value), sourceRegionIdentity: null, warnings: [], diagnosticConfidence: null };
}
function localExtraction(): DrawingImportPageExtraction {
  const empty = () => emptyDrawingField<string>();
  return { schemaVersion: 'drawing-page-extraction-v3', pageId: 'page-1', classification: 'part_drawing', classificationEvidence: [],
    partNumber: localField('DWG-447', 'DRAWING NO: DWG-447'), partName: localField('BRACKET'), drawingQuantity: localField(1),
    material: localField('STEEL'), finish: empty(), stockSize: empty(), cutLength: empty(), finalLength: empty(),
    partWidth: empty(), partThickness: empty(), revision: empty(), assemblyStatus: localField(false),
    route: 'local', autoAcceptedFields: [], warnings: [] };
}
function aiExtraction(finish: string | null): DrawingImportAiExtraction {
  const fields = Object.fromEntries(DRAWING_IMPORT_FIELD_NAMES.map(name => [name, aiField<string>(null)])) as unknown as DrawingImportAiExtraction;
  return { ...fields, classification: 'part_drawing', classificationEvidenceText: 'drawing', partNumber: aiField('JOB-999'),
    finish: aiField(finish), drawingQuantity: aiField(1), assemblyStatus: aiField(false),
    manufacturingNotes: [], contradictions: [], warnings: [] };
}
const page: CoordinateAwarePageText = { pageNumber: 1, pageWidth: 612, pageHeight: 792, pageRotation: 0, extractionMethod: 'embedded_text', rawText: '', spans: [], lines: [] };

describe('drawing identity and finish policy', () => {
  it('uses the model-selected part identifier and defaults absent finish to NA', () => {
    const merged = mergeDrawingImportAiExtraction({ local: localExtraction(), ai: aiExtraction(null), page, route: 'terra_full_page', preferModel: true });
    expect(merged.partNumber.value).toBe('JOB-999');
    expect(merged.finish).toMatchObject({ value: 'NA', status: 'derived_locally' });
  });
  it('rejects REVISION when it is returned as the part number value', () => {
    const ai = aiExtraction(null);
    ai.partNumber = aiField('REVISION');
    const merged = mergeDrawingImportAiExtraction({ local: localExtraction(), ai, page, route: 'terra_full_page', preferModel: true });
    expect(merged.partNumber).toMatchObject({ value: null, status: 'unreadable' });
  });
  it.each(['NA', 'N/A', 'NONE', 'NO FINISH', 'NOT APPLICABLE'])('normalizes explicit %s finish to NA', value => {
    const merged = mergeDrawingImportAiExtraction({ local: localExtraction(), ai: aiExtraction(value), page, route: 'terra_full_page', preferModel: true });
    expect(merged.finish).toMatchObject({ value: 'NA', status: 'read' });
  });
  it('keeps unreadable and conflicting finish unresolved', () => {
    for (const status of ['unreadable', 'conflicting'] as const) {
      const ai = aiExtraction(null); ai.finish.status = status;
      expect(mergeDrawingImportAiExtraction({ local: localExtraction(), ai, page, route: 'terra_full_page', preferModel: true }).finish.value).toBeNull();
    }
  });
});
