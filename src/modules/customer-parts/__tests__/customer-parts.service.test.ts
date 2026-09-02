import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ list: vi.fn(), find: vi.fn() }));
vi.mock('../customer-parts.repo', () => ({
  listHistoricalCustomerParts: repo.list,
  findHistoricalCustomerPart: repo.find,
}));

import { getCustomerPartHistoryDetail, listCustomerPartHistory } from '../customer-parts.service';

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'part-1', partNumber: ' ab-100 ', partName: 'Bracket', materialId: 'mat-1', drawingMaterialText: '4140', drawingFinishText: null,
    finish: null, stockSize: '1 x 2 x 4', cutLength: '4.125', finalPartLength: '4', partWidth: '2', partThickness: '1',
    notes: 'Deburr all edges.', workInstructions: 'Use fixture A.', updatedAt: new Date('2026-02-02T00:00:00Z'),
    material: { name: '4140' },
    attachments: [
      { kind: 'DWG', url: null, storagePath: 'customer/drawing.pdf', label: 'drawing.pdf', mimeType: 'application/pdf' },
      { kind: 'PO', url: null, storagePath: 'customer/po.pdf', label: 'purchase order.pdf', mimeType: 'application/pdf' },
    ],
    drawingImportPage: {
      id: 'page-1', jobId: 'job-1', sourceFilename: 'drawing.pdf', sourcePageNumber: 2, canonicalPdfStoragePath: 'canonical.pdf', localExtractionJson: null,
      finalExtractionJson: JSON.stringify({ manufacturingNotes: [{ text: 'PREHEAT TO 600-700F', category: 'preheat_heat_treat', evidence: [{ sourceRegion: [0.1, 0.2, 0.4, 0.3] }], warnings: [], diagnosticConfidence: 0.9 }] }),
    },
    order: { id: 'order-1', customerId: 'customer-a', customer: { name: 'Acme' }, orderNumber: 'CRM-1001', status: 'COMPLETED', business: 'CRM', receivedDate: new Date('2026-02-01T00:00:00Z') },
    ...overrides,
  };
}

describe('customer part history service', () => {
  beforeEach(() => { repo.list.mockReset(); repo.find.mockReset(); });

  it('groups normalized part numbers while preserving conflicting source versions', async () => {
    repo.list.mockResolvedValue([
      record(),
      record({ id: 'part-2', partNumber: 'AB 100', finish: 'Zinc', order: { ...record().order, id: 'order-2', orderNumber: 'CRM-999' } }),
    ]);
    const result = await listCustomerPartHistory('customer-a', { take: 40 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({ normalizedPartNumber: 'AB100', versionCount: 2, hasConflictingVersions: true });
    expect(result.data.items[0].versions.map((item) => item.sourcePartId)).toEqual(['part-1', 'part-2']);
    expect(repo.list).toHaveBeenCalledWith({ candidateLimit: 320 });
  });

  it('looks up a selected source part globally and returns not found cleanly', async () => {
    repo.find.mockResolvedValue(null);
    const result = await getCustomerPartHistoryDetail('customer-b', 'part-1');
    expect(result).toEqual({ ok: false, status: 404, error: 'Historical customer part not found.' });
    expect(repo.find).toHaveBeenCalledWith({ sourcePartId: 'part-1' });
  });

  it('returns only drawing attachments and keeps extracted notes as explicit review suggestions', async () => {
    repo.find.mockResolvedValue(record());
    const result = await getCustomerPartHistoryDetail('customer-a', 'part-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.attachments).toEqual([expect.objectContaining({ kind: 'DWG', storagePath: 'customer/drawing.pdf' })]);
    expect(result.data.noteSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'reviewed_part_note', requiresDrawingReview: false }),
      expect.objectContaining({ source: 'reviewed_work_instruction', requiresDrawingReview: false }),
      expect.objectContaining({ source: 'drawing_extraction', text: 'PREHEAT TO 600-700F', evidenceQuality: 'mapped_region', requiresDrawingReview: true }),
    ]));
    expect(result.data.noteSuggestions.find((item) => item.source === 'drawing_extraction')?.evidenceHref).toContain('/job-1/pages/page-1/artifact?kind=canonical');
  });
});
