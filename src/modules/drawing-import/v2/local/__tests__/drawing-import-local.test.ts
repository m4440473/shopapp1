import { describe, expect, it } from 'vitest';

import type { CoordinateAwarePageText, ReconstructedTextLine } from '../../document';
import { classifyDrawingPage, extractLocalDrawingFields, locallyAcceptableFields, matchTitleBlockProfile } from '../drawing-import-local';

function line(text: string, top: number): ReconstructedTextLine {
  return { text, normalizedText: text, region: [0.7, top, 0.98, top + 0.04], spanReadingOrders: [], rotationDegrees: 0 };
}

function page(lines: ReconstructedTextLine[]): CoordinateAwarePageText {
  return {
    pageNumber: 1,
    pageWidth: 1000,
    pageHeight: 700,
    pageRotation: 0,
    rawText: lines.map((entry) => entry.text).join('\n'),
    spans: [],
    lines,
    extractionMethod: 'embedded_text',
  };
}

describe('Drawing Import V2 local analysis', () => {
  it('classifies and parses an anchored title block without guessing missing fields', () => {
    const text = page([
      line('DWG NO: PJ-10904-D5501', 0.72),
      line('PART NAME: TURBO FIXTURE PLATE', 0.77),
      line('MATERIAL: 4140 PH', 0.82),
      line('REV: B', 0.87),
    ]);
    const result = extractLocalDrawingFields({ pageId: 'page-1', filename: 'PJ-10904-D5501.pdf', page: text });
    expect(result.classification.classification).toBe('part_drawing');
    expect(result.extraction.partNumber.value).toBe('PJ-10904-D5501');
    expect(result.extraction.partNumber.evidence[0].agreementSignals).toContain('filename');
    expect(result.extraction.material.value).toBe('4140 PH');
    expect(result.extraction.drawingQuantity.value).toBeNull();
  });

  it('classifies standalone BOM columns before creating normal parts', () => {
    const classification = classifyDrawingPage(page([
      line('BILL OF MATERIALS', 0.1),
      line('ITEM  PART NUMBER  DESCRIPTION  QTY', 0.2),
    ]), 'assembly-bom.pdf');
    expect(classification.classification).toBe('bom');
  });

  it('rejects a title profile when layout alone matches but required anchors do not', () => {
    const match = matchTitleBlockProfile(page([line('MATERIAL: 6061', 0.8)]), {
      profileIdentifier: 'customer-a',
      version: 1,
      expectedAspectRatios: [{ minimum: 1.3, maximum: 1.5 }],
      orientations: ['landscape'],
      requiredAnchors: [{ label: 'DWG NO', aliases: ['DRAWING NUMBER'], expectedRegion: [0.6, 0.6, 1, 1] }],
      fieldRegions: {},
      active: true,
    });
    expect(match.matched).toBe(false);
    expect(match.warnings).toContain('required-anchors-missing');
  });

  it('auto-accepts critical fields only with independent agreement', () => {
    const result = extractLocalDrawingFields({
      pageId: 'page-1',
      filename: 'PART-100.pdf',
      page: page([line('DWG NO: PART-100', 0.8), line('MATERIAL: 6061-T6', 0.85)]),
    });
    expect(locallyAcceptableFields(result.extraction, { enabled: false, profileMatched: false })).toEqual([]);
    expect(locallyAcceptableFields(result.extraction, { enabled: true, profileMatched: false })).toEqual(['partNumber']);
  });
});
