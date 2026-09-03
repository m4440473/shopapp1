import { describe, expect, it } from 'vitest';

import type { BomTextSpan } from '../bom.types';
import { reconstructBomTable } from '../bom-table';

function span(text: string, x1: number, x2: number, y1: number, y2: number, readingOrder: number): BomTextSpan {
  return { pageId: 'page-bom', text, region: [x1, y1, x2, y2], readingOrder };
}

describe('BOM table reconstruction', () => {
  it('reconstructs evidence-backed rows from coordinate-aligned headers and cells', () => {
    const spans = [
      span('ITEM', 0.04, 0.10, 0.10, 0.12, 1),
      span('PART', 0.16, 0.22, 0.10, 0.12, 2),
      span('NUMBER', 0.23, 0.33, 0.10, 0.12, 3),
      span('DESCRIPTION', 0.40, 0.56, 0.10, 0.12, 4),
      span('QTY', 0.67, 0.72, 0.10, 0.12, 5),
      span('MATERIAL', 0.78, 0.90, 0.10, 0.12, 6),
      span('REV', 0.93, 0.97, 0.10, 0.12, 7),
      span('12', 0.05, 0.08, 0.17, 0.19, 8),
      span('SMW-1042-03', 0.16, 0.33, 0.17, 0.19, 9),
      span('SHAFT, DRIVE', 0.39, 0.57, 0.17, 0.19, 10),
      span('4', 0.68, 0.70, 0.17, 0.19, 11),
      span('4140 PH', 0.78, 0.89, 0.17, 0.19, 12),
      span('B', 0.94, 0.96, 0.17, 0.19, 13),
      span('HARDENED', 0.40, 0.51, 0.205, 0.225, 14),
    ];

    const result = reconstructBomTable('page-bom', spans, { parentAssemblyPartNumber: 'SMW-1042' });

    expect(result.detectedColumns.map((column) => column.name)).toEqual([
      'item', 'partNumber', 'description', 'quantityPerParent', 'material', 'revision',
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      sourcePageId: 'page-bom',
      item: { value: '12', status: 'read' },
      partNumber: { value: 'SMW-1042-03', status: 'read' },
      description: { value: 'SHAFT, DRIVE HARDENED', status: 'read' },
      quantityPerParent: { value: 4, status: 'read' },
      material: { value: '4140 PH', status: 'read' },
      revision: { value: 'B', status: 'read' },
      parentAssemblyPartNumber: { value: 'SMW-1042' },
    });
    expect(result.rows[0].partNumber.evidence[0]).toMatchObject({
      sourceType: 'embedded_text',
      sourcePageId: 'page-bom',
      parser: 'bom_table_v1',
    });
    expect(result.rows[0].partNumber.evidence[0].sourceRegion).toEqual([0.16, 0.17, 0.33, 0.19]);
  });

  it('keeps invalid quantities explicit instead of inventing a value', () => {
    const result = reconstructBomTable('page-bom', [
      span('PART NO', 0.10, 0.30, 0.10, 0.12, 1),
      span('QTY', 0.70, 0.80, 0.10, 0.12, 2),
      span('P-100', 0.10, 0.30, 0.18, 0.20, 3),
      span('TBD', 0.70, 0.80, 0.18, 0.20, 4),
    ]);

    expect(result.rows[0].quantityPerParent).toMatchObject({ value: null, status: 'unreadable', rawText: 'TBD' });
    expect(result.rows[0].warnings[0]).toContain('not a positive integer');
  });

  it('refuses to reconstruct a table without both part-number and quantity columns', () => {
    const result = reconstructBomTable('page-bom', [
      span('ITEM', 0.10, 0.20, 0.10, 0.12, 1),
      span('DESCRIPTION', 0.30, 0.60, 0.10, 0.12, 2),
    ]);
    expect(result.rows).toEqual([]);
    expect(result.warnings).toContain('Could not establish both part-number and quantity BOM columns.');
  });
});
