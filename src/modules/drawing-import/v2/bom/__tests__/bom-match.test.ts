import { describe, expect, it } from 'vitest';

import { emptyDrawingField, type DrawingImportFieldValue } from '../../drawing-import-v2.types';
import { matchBomRowsToDrawingPages, normalizeBomPartNumber } from '../bom-match';
import type { BomDrawingPageCandidate, DrawingBomRow } from '../bom.types';

function field<T extends string | number>(value: T | null): DrawingImportFieldValue<T> {
  return value === null
    ? emptyDrawingField<T>()
    : { value, rawText: String(value), status: 'read', evidence: [], candidates: [], warnings: [], diagnosticConfidence: null };
}

function row(partNumber: string, revision: string | null = null): DrawingBomRow {
  return {
    id: `row-${partNumber}`,
    sourcePageId: 'bom-page',
    rowIndex: 0,
    item: field('12'),
    partNumber: field(partNumber),
    description: field('SHAFT DRIVE'),
    quantityPerParent: field(2),
    material: field('4140'),
    revision: field(revision),
    parentAssemblyPartNumber: field('ASM-1'),
    sourceRegion: [0, 0, 1, 0.1],
    rawCells: {},
    warnings: [],
  };
}

function page(pageId: string, partNumber: string, revision: string | null = null, filename?: string): BomDrawingPageCandidate {
  return {
    pageId,
    partNumber: field(partNumber),
    revision: field(revision),
    partName: field('SHAFT DRIVE'),
    filename,
    itemReferences: ['12'],
  };
}

describe('deterministic BOM row matching', () => {
  it('normalizes conservative CAD punctuation without fuzzy matching', () => {
    expect(normalizeBomPartNumber(' smw–1042 - 03 ')).toBe('SMW-1042-03');
  });

  it('uses exact part number plus revision/description/item agreement', () => {
    const [match] = matchBomRowsToDrawingPages([row('SMW-1042-03', 'B')], [page('page-3', 'SMW-1042-03', 'B')]);
    expect(match).toMatchObject({ status: 'matched', matchedPageId: 'page-3' });
    expect(match.candidates[0].signals).toEqual(expect.arrayContaining(['exact_part_number', 'revision', 'exact_description', 'item_number']));
  });

  it('leaves equally ranked exact matches ambiguous', () => {
    const [match] = matchBomRowsToDrawingPages(
      [row('P-100')],
      [page('page-a', 'P-100'), page('page-b', 'P-100')],
    );
    expect(match).toMatchObject({ status: 'ambiguous', matchedPageId: null });
  });

  it('reports revision conflicts instead of selecting cosmetically', () => {
    const [match] = matchBomRowsToDrawingPages([row('P-100', 'B')], [page('page-a', 'P-100', 'A')]);
    expect(match).toMatchObject({ status: 'revision_conflict', matchedPageId: null });
  });

  it('applies only explicitly configured prefix normalization', () => {
    const [withoutRule] = matchBomRowsToDrawingPages([row('100-20')], [page('page-a', 'STD-100-20')]);
    const [withRule] = matchBomRowsToDrawingPages(
      [row('100-20')],
      [page('page-a', 'STD-100-20')],
      { knownPartNumberPrefixes: ['STD-'] },
    );
    expect(withoutRule.status).toBe('missing');
    expect(withRule).toMatchObject({ status: 'matched', matchedPageId: 'page-a' });
    expect(withRule.candidates[0].signals).toContain('configured_part_number_normalization');
  });
});
