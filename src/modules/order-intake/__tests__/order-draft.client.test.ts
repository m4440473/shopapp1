import { describe, expect, it } from 'vitest';
import { mergeImportedOrderParts, mergeOrderDraftFiles, orderDraftTarget, orderPartReadiness, orderPartHasInput } from '../order-draft.client';

describe('order draft boundaries', () => {
  it('isolates fresh, repeat and conversion drafts and their submission endpoints', () => {
    expect(orderDraftTarget(null, null)).toEqual({ key: 'new', scope: 'order:create', url: '/api/orders' });
    expect(orderDraftTarget('template-1', 'quote-1')).toEqual({ key: 'repeat:template-1', scope: 'order:repeat:template-1', url: '/api/repeat-order-templates/template-1/create-order' });
    expect(orderDraftTarget(null, 'quote-1')).toEqual({ key: 'convert:quote-1', scope: 'quote:convert:quote-1', url: '/api/admin/quotes/quote-1/convert' });
    expect(orderDraftTarget(null, 'quote-2').key).not.toBe(orderDraftTarget(null, 'quote-1').key);
  });

  it('deduplicates retry transfers by page while preserving later parent edits and warnings', () => {
    const saved = { key: 'old-key', drawingImportPageId: 'page-1', quantity: '25', unresolvedFields: ['material'] };
    const incoming = { key: 'new-key', drawingImportPageId: 'page-1', quantity: '12', unresolvedFields: [] };
    const other = { key: 'other', drawingImportPageId: 'page-2', quantity: '2', unresolvedFields: [] };
    expect(mergeImportedOrderParts([saved], [incoming, other, other])).toEqual([saved, other]);
    expect(mergeImportedOrderParts([saved], [])).toEqual([saved]);
  });

  it('keeps original and page files once, preserving existing labels', () => {
    const source = { storagePath: 'original/packet.pdf', url: '', label: 'Customer packet' };
    const page = { storagePath: 'pages/page-1.pdf', url: '', label: 'File only' };
    expect(mergeOrderDraftFiles([source, { storagePath: '', url: '', label: '' }], [{ ...source, label: 'Duplicate' }, page, page])).toEqual([source, page]);
  });

  it('preserves partly entered manual rows when importing more drawings', () => {
    const empty = { key: 'p1', quantity: '1', partNumber: '', partName: '', materialId: '', notes: '', finalPartLength: '', attachments: [] };
    expect(orderPartHasInput(empty)).toBe(false);
    for (const patch of [{ partName: 'Bracket' }, { materialId: '6061' }, { notes: 'Customer instruction' }, { finalPartLength: '6 in' }, { quantity: '' }]) {
      expect(orderPartHasInput({ ...empty, ...patch })).toBe(true);
    }
  });

  it.each(['', '0', '-1', '2.5', 'NaN', '9007199254740992'])('blocks invalid quantity %s without normalizing it to 1', (quantity) => {
    expect(orderPartReadiness([{ key: 'p1', partNumber: 'Bracket', partName: '', quantity }])).toEqual({ partKey: 'p1', message: 'Bracket: quantity must be a positive whole number.' });
  });

  it('allows an identified positive-quantity part without inventing optional dimensions or material', () => {
    expect(orderPartReadiness([{ key: 'p1', partNumber: 'Bracket', partName: '', quantity: '12' }])).toBeNull();
    expect(orderPartReadiness([{ key: 'p1', partNumber: '', partName: 'Bracket', quantity: '12' }])?.partKey).toBe('p1');
  });
});
