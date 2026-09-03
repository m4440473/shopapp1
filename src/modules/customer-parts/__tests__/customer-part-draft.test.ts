import { describe, expect, it } from 'vitest';

import { mapCustomerPartDetailToReusableDraft } from '../customer-part-draft';
import type { CustomerPartHistoryDetail } from '../customer-parts.types';

function detail(): CustomerPartHistoryDetail {
  return {
    customerId: 'customer-a',
    sourcePartId: 'old-part',
    sourceOrderId: 'old-order',
    sourceOrderNumber: 'CRM-1001',
    sourceOrderStatus: 'COMPLETED',
    business: 'CRM',
    receivedAt: '2026-01-01T00:00:00.000Z',
    partNumber: 'A-100',
    partName: 'Bracket',
    materialId: 'material-1',
    drawingMaterialText: '4140 PREHARD',
    drawingFinishText: 'BLACK OXIDE',
    finish: 'Black oxide',
    stockSize: '1 x 2 x 4.125',
    cutLength: '4.125',
    finalPartLength: '4',
    partWidth: '2',
    partThickness: '1',
    drawingImportPageId: 'page-1',
    attachments: [{ kind: 'DWG', url: null, storagePath: 'old/drawing.pdf', label: 'A-100.pdf', mimeType: 'application/pdf' }],
    noteSuggestions: [{
      id: 'suggestion-1', destination: 'workInstructions', text: 'PREHEAT TO 600-700F', source: 'drawing_extraction',
      sourceLabel: 'A-100.pdf, page 1', evidenceHref: '/evidence', evidenceQuality: 'mapped_region', requiresDrawingReview: true,
    }],
  };
}

describe('mapCustomerPartDetailToReusableDraft', () => {
  it('copies static manufacturing data and drawing metadata into a new identity', () => {
    const draft = mapCustomerPartDetailToReusableDraft(detail(), () => 'new-draft');
    expect(draft).toMatchObject({
      key: 'new-draft', sourcePartId: 'old-part', partNumber: 'A-100', partName: 'Bracket', materialId: 'material-1',
      drawingImportPageId: 'page-1', finalPartLength: '4', partWidth: '2', partThickness: '1',
    });
    expect(draft.attachments).toEqual([expect.objectContaining({ storagePath: 'old/drawing.pdf', kind: 'DWG' })]);
    expect(draft.attachments[0]).not.toBe(detail().attachments[0]);
  });

  it('resets quantity, availability, procurement, pricing inputs, work items, and notes', () => {
    const draft = mapCustomerPartDetailToReusableDraft(detail(), () => 'new-draft');
    expect(draft).toMatchObject({
      quantity: '1', pieceCount: '1', materialStatus: 'UNREVIEWED', inventoryLocation: '', materialNotes: '',
      procurementVendorId: '', procurementCost: '', procurementMarkupPercent: '20', notes: '', workInstructions: '', addonSelections: [],
    });
    expect(draft.noteSuggestions).toHaveLength(1);
  });
});
