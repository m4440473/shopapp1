import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { mergeImportedOrderParts, mergeOrderDraftFiles, orderPartHasInput } from '../order-draft.client';

const pagePath = path.resolve('src/app/orders/new/page.tsx');
function load(name: string, scope: Record<string, unknown>) {
  const source = ts.createSourceFile(pagePath, readFileSync(pagePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!declaration) throw new Error(`Missing form function ${name}`);
  const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(scope), `${code}\nreturn ${name};`)(...Object.values(scope));
}

const pending = { version: 1, key: 'original-key', scope: 'order:create', url: '/api/orders', payload: { parts: [{ partNumber: 'P1', quantity: 12 }] } };

describe('order saved submission recovery uses the actual form handlers', () => {
  function scope() {
    return {
      pendingSubmissionRef: { current: pending as typeof pending | null }, submissionInFlight: { current: false },
      setLoading: vi.fn(), setMessage: vi.fn(), setCreatedOrderId: vi.fn(), setPendingSubmission: vi.fn(),
      durableDraft: { flush: vi.fn(async () => true), clear: vi.fn(async () => true) },
      draftData: { notes: 'Keep my work', parts: pending.payload.parts, pendingSubmission: pending },
      completeSavedSubmission: vi.fn(async () => undefined),
      submitPendingCreationSubmission: vi.fn(async () => ({ state: 'unknown', error: 'Response lost' })),
      lookupPendingCreationSubmission: vi.fn(async () => ({ state: 'created', id: 'order-17' })),
      suppressOrderDraft: { current: false }, clearDrawingImportDraft: vi.fn(), window: { localStorage: {} },
      attachmentBusiness: 'Sterling Tool and Die', customers: [], customerId: 'c1', router: { push: vi.fn() },
    };
  }

  it('never retries a POST before the exact pending envelope is durably acknowledged', async () => {
    const state = scope();
    state.durableDraft.flush.mockResolvedValueOnce(false);
    await load('recoverSubmission', state)(false);
    expect(state.durableDraft.flush).toHaveBeenCalledWith(state.draftData);
    expect(state.completeSavedSubmission).not.toHaveBeenCalled();
    expect(state.pendingSubmissionRef.current).toBe(pending);
    await load('recoverSubmission', state)(false);
    expect(state.completeSavedSubmission).toHaveBeenCalledWith(pending, false);
  });

  it('allows lookup even when the draft controller no longer accepts writes after failed cleanup', async () => {
    const state = scope();
    state.durableDraft.flush.mockResolvedValue(false);
    await load('recoverSubmission', state)(true);
    expect(state.durableDraft.flush).not.toHaveBeenCalled();
    expect(state.completeSavedSubmission).toHaveBeenCalledWith(pending, true);
  });

  it('prevents overlapping recovery and keeps the exact envelope after an exception', async () => {
    const state = scope();
    let reject!: (error: Error) => void;
    state.completeSavedSubmission.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const recover = load('recoverSubmission', state);
    const first = recover(true);
    await recover(false);
    expect(state.completeSavedSubmission).toHaveBeenCalledTimes(1);
    reject(new Error('Offline'));
    await first;
    expect(state.pendingSubmissionRef.current).toBe(pending);
    expect(state.submissionInFlight.current).toBe(false);
    expect(state.setLoading).toHaveBeenLastCalledWith(false);
  });

  it('keeps unknown results frozen without clearing or navigating', async () => {
    const state = scope();
    await load('completeSavedSubmission', state)(pending, false);
    expect(state.pendingSubmissionRef.current).toBe(pending);
    expect(state.setPendingSubmission).not.toHaveBeenCalled();
    expect(state.durableDraft.clear).not.toHaveBeenCalled();
    expect(state.router.push).not.toHaveBeenCalled();
  });

  it('requires durable removal of a rejected pending request before unlocking edits', async () => {
    const state = scope();
    state.submitPendingCreationSubmission.mockResolvedValue({ state: 'rejected', error: 'Quantity is invalid' });
    state.durableDraft.flush.mockResolvedValueOnce(false);
    const complete = load('completeSavedSubmission', state);
    await complete(pending, false);
    expect(state.pendingSubmissionRef.current).toBe(pending);
    expect(state.setPendingSubmission).not.toHaveBeenCalled();
    await complete(pending, false);
    expect(state.durableDraft.flush).toHaveBeenLastCalledWith({ ...state.draftData, pendingSubmission: null });
    expect(state.pendingSubmissionRef.current).toBeNull();
    expect(state.setPendingSubmission).toHaveBeenLastCalledWith(null);
  });

  it('navigates only after created result and draft-delete acknowledgment, retrying cleanup by lookup', async () => {
    const state = scope();
    state.durableDraft.clear.mockResolvedValueOnce(false);
    const complete = load('completeSavedSubmission', state);
    await complete(pending, true);
    expect(state.router.push).not.toHaveBeenCalled();
    expect(state.pendingSubmissionRef.current).toBe(pending);
    await complete(pending, true);
    expect(state.submitPendingCreationSubmission).not.toHaveBeenCalled();
    expect(state.router.push).toHaveBeenCalledOnce();
    expect(state.router.push).toHaveBeenCalledWith('/orders/order-17');
  });

  it('cancels only after saving all current data and refuses to cancel an unresolved submission', async () => {
    const state = scope();
    const cancel = load('cancelOrderEntry', state);
    await cancel();
    expect(state.durableDraft.flush).not.toHaveBeenCalled();
    state.pendingSubmissionRef.current = null;
    state.durableDraft.flush.mockResolvedValueOnce(false);
    await cancel();
    expect(state.router.push).not.toHaveBeenCalled();
    await cancel();
    expect(state.durableDraft.flush).toHaveBeenLastCalledWith(state.draftData);
    expect(state.router.push).toHaveBeenCalledWith('/');
  });
});

describe('order import handoff waits for the parent draft', () => {
  function importScope() {
    const parts = [{ key: 'manual', partNumber: '', partName: 'Partly entered bracket', quantity: '1', attachments: [], notes: 'Keep this instruction' }];
    return {
      durableDraft: { ready: true, editingBlocked: false, flush: vi.fn(async (_data: Record<string, unknown>) => true) },
      pendingSubmissionRef: { current: null }, submissionInFlight: { current: false },
      emptyPart: () => ({ key: 'empty', partNumber: '', partName: '', quantity: '1', addonSelections: [], attachments: [] }),
      buildFinishPartNotes: () => '', mergeImportedOrderParts, mergeOrderDraftFiles, orderPartHasInput,
      parts, attachments: [{ storagePath: 'existing.pdf', url: '', label: 'Original file', mimeType: 'application/pdf' }],
      activePartKey: 'manual', draftData: { notes: 'Order notes', parts },
      setParts: vi.fn(), setAttachments: vi.fn(), setActivePartKey: vi.fn(), setPartEntryMode: vi.fn(), setMessage: vi.fn(), setLoading: vi.fn(),
    };
  }

  it('keeps import review and partial parent work intact on rejected save, then transfers warning metadata once', async () => {
    const state = importScope();
    state.durableDraft.flush.mockResolvedValueOnce(false);
    const part = { key: 'import-1', importPageId: 'page-1', partNumber: 'P1', partName: 'Drawing bracket', quantity: 12, materialId: '', unresolvedFields: ['material'], reviewWarnings: ['Material needs review'], source: { storagePath: 'page-1.pdf', mimeType: 'application/pdf', label: 'Part page' } };
    const apply = load('applyImportedDrawingParts', state);
    await expect(apply([part], [part.source])).rejects.toThrow('could not be saved');
    expect(state.setParts).not.toHaveBeenCalled();
    expect(state.setAttachments).not.toHaveBeenCalled();
    expect(state.setPartEntryMode).not.toHaveBeenCalled();
    expect(state.submissionInFlight.current).toBe(false);
    await apply([part], [part.source]);
    const candidate = state.durableDraft.flush.mock.calls[1][0] as any;
    expect(candidate.parts[0]).toBe(state.parts[0]);
    expect(candidate.parts[1]).toMatchObject({ drawingImportPageId: 'page-1', unresolvedFields: ['material'], reviewWarnings: ['Material needs review'] });
    expect(candidate.attachments.map((file: any) => file.storagePath)).toEqual(['existing.pdf', 'page-1.pdf']);
    expect(state.setParts).toHaveBeenCalledWith(candidate.parts);
    expect(state.setPartEntryMode).toHaveBeenCalledWith('manual');
    expect(state.durableDraft.flush.mock.invocationCallOrder[1]).toBeLessThan(state.setParts.mock.invocationCallOrder[0]);
  });

  it('retains every existing part during a file-only zero-part transfer', async () => {
    const state = importScope();
    await load('applyImportedDrawingParts', state)([], [{ storagePath: 'support.pdf', mimeType: 'application/pdf', label: 'Support page' }]);
    expect(state.setParts).toHaveBeenCalledWith(state.parts);
    expect(state.setActivePartKey).toHaveBeenCalledWith('manual');
    expect(state.setAttachments.mock.calls[0][0].map((file: any) => file.storagePath)).toEqual(['existing.pdf', 'support.pdf']);
  });

  it('blocks edits, autosave and overlapping transfer while the candidate acknowledgment is pending', async () => {
    const state = importScope();
    let finish!: (saved: boolean) => void;
    state.durableDraft.flush.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const apply = load('applyImportedDrawingParts', state);
    const transfer = apply([], [{ storagePath: 'support.pdf', mimeType: 'application/pdf', label: 'Support page' }]);
    expect(state.submissionInFlight.current).toBe(true);
    expect(state.setLoading).toHaveBeenLastCalledWith(true);
    expect(state.setPartEntryMode).not.toHaveBeenCalled();
    await expect(apply([], [])).rejects.toThrow('Wait for the saved draft');
    expect(state.durableDraft.flush).toHaveBeenCalledOnce();
    finish(true);
    await transfer;
    expect(state.submissionInFlight.current).toBe(false);
    expect(state.setLoading).toHaveBeenLastCalledWith(false);
  });
});
