import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { ORDER_SUBMISSION_UNCONFIRMED_MESSAGE } from '../order-submission.client';

// Execute the actual nested form handler without mounting the unrelated editor/browser effects.
function functionSource(sourcePath: string, name: string) {
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) handler = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw new Error(`The form function ${name} was not found.`);
  return ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
}

function loadHandler(sourcePath: string, submitOrder: () => Promise<void>) {
  const code = functionSource(sourcePath, 'handleSubmit');
  const submissionInFlight = { current: false };
  const setLoading = vi.fn();
  const setMessage = vi.fn();
  const handleSubmit = new Function('submissionInFlight', 'setLoading', 'setMessage', 'submitOrder', `${code}\nreturn handleSubmit;`)(submissionInFlight, setLoading, setMessage, submitOrder) as (event: { preventDefault: () => void }) => Promise<void>;
  return { handleSubmit, submissionInFlight, setLoading, setMessage };
}

const sources = [
  ['workstation', path.resolve('src/app/orders/new/page.tsx')],
  ['live deployment snapshot', path.resolve('.tmp/order-create-hotfix-20260910/live/app/orders/new/page.tsx')],
].filter(([, sourcePath]) => existsSync(sourcePath));

describe.each(sources)('%s new-order submission lifecycle', (_label, sourcePath) => {
  it('unlocks and shows a check-Orders message after an unexpected submission rejection', async () => {
    const submitOrder = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const form = loadHandler(sourcePath, submitOrder);
    await expect(form.handleSubmit({ preventDefault: vi.fn() })).resolves.toBeUndefined();
    expect(form.setLoading.mock.calls).toEqual([[true], [false]]);
    expect(form.submissionInFlight.current).toBe(false);
    expect(form.setMessage).toHaveBeenCalledWith(expect.stringContaining('Check Orders before trying again'));
  });

  it('blocks a second immediate submit until the first has settled, then permits a new user action', async () => {
    let finish!: () => void;
    const submitOrder = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const form = loadHandler(sourcePath, submitOrder);
    const first = form.handleSubmit({ preventDefault: vi.fn() });
    await form.handleSubmit({ preventDefault: vi.fn() });
    expect(submitOrder).toHaveBeenCalledTimes(1);
    expect(form.submissionInFlight.current).toBe(true);
    finish();
    await first;
    expect(form.submissionInFlight.current).toBe(false);
    submitOrder.mockResolvedValueOnce(undefined);
    await form.handleSubmit({ preventDefault: vi.fn() });
    expect(submitOrder).toHaveBeenCalledTimes(2);
  });

  it('resets submitting after validation returns early without changing its message', async () => {
    const form = loadHandler(sourcePath, async () => undefined);
    await form.handleSubmit({ preventDefault: vi.fn() });
    expect(form.setLoading.mock.calls).toEqual([[true], [false]]);
    expect(form.setMessage).not.toHaveBeenCalled();
    expect(form.submissionInFlight.current).toBe(false);
  });

  it.each([ORDER_SUBMISSION_UNCONFIRMED_MESSAGE, 'This order number is already in use.'])('keeps entered parts and saved draft when creation returns: %s', async (error) => {
    const parts = [{ partNumber: 'P-1', partName: 'Bracket', quantity: '12', addonSelections: [], attachments: [] }];
    const scope: Record<string, any> = {
      templateMode: false, repeatTemplate: null, templateId: null, conversionMode: false, quoteId: null,
      customerId: 'customer-1', customerContactId: '', parts, attachments: [], customFields: [], customFieldValues: {},
      dueDate: '2026-09-30', priority: 'NORMAL', business: 'STD', modelIncluded: false,
      materialNeeded: false, materialOrdered: false, vendorId: '', poNumber: '', assignedMachinistId: '', assignedWorkerIds: [], selectedAddonIds: [], notes: 'Keep this note',
      normalizeOrderQuantityInput: Number,
      resolveRepeatOrderCustomer: (customerId: string) => customerId,
      submitDirectOrder: vi.fn(async () => ({ ok: false, error })),
      setMessage: vi.fn(), setCreatedOrderId: vi.fn(), setLoading: vi.fn(), setCurrentStep: vi.fn(),
      setParts: vi.fn(), setCustomerId: vi.fn(), setNotes: vi.fn(),
      clearIntakeDraft: vi.fn(), clearDrawingImportDraft: vi.fn(),
    };
    if (_label === 'workstation') {
      Object.assign(scope, {
        pendingSubmissionRef: { current: null }, setPendingSubmission: vi.fn(),
        durableDraft: { ready: true, legacyAvailable: false, flush: vi.fn(async () => true), clear: vi.fn() },
        prefillReady: true, suppressOrderDraft: { current: false }, validateStep: () => true,
        draftData: { parts, notes: 'Keep this note' }, draftTarget: { scope: 'order:create', url: '/api/orders' },
        createPendingCreationSubmission: (_scope: string, _url: string, payload: unknown) => ({ key: 'saved-key', payload }),
        submitPendingCreationSubmission: vi.fn(async () => ({ state: error === ORDER_SUBMISSION_UNCONFIRMED_MESSAGE ? 'unknown' : 'rejected', error })),
      });
      const completeCode = functionSource(sourcePath, 'completeSavedSubmission');
      scope.completeSavedSubmission = new Function(...Object.keys(scope), `${completeCode}\nreturn completeSavedSubmission;`)(...Object.values(scope));
    }
    const code = functionSource(sourcePath, 'submitOrder');
    const submit = new Function(...Object.keys(scope), `${code}\nreturn submitOrder;`)(...Object.values(scope)) as () => Promise<void>;
    await submit();
    expect(_label === 'workstation' ? scope.submitPendingCreationSubmission : scope.submitDirectOrder).toHaveBeenCalledTimes(1);
    if (_label === 'workstation') {
      expect(scope.durableDraft.flush).toHaveBeenNthCalledWith(1, { ...scope.draftData, pendingSubmission: scope.submitPendingCreationSubmission.mock.calls[0][0] });
      expect(scope.durableDraft.flush.mock.invocationCallOrder[0]).toBeLessThan(scope.submitPendingCreationSubmission.mock.invocationCallOrder[0]);
    }
    expect(scope.setMessage).toHaveBeenLastCalledWith(error);
    expect(scope.setParts).not.toHaveBeenCalled();
    expect(scope.setCustomerId).not.toHaveBeenCalled();
    expect(scope.setNotes).not.toHaveBeenCalled();
    expect(scope.clearIntakeDraft).not.toHaveBeenCalled();
    expect(scope.clearDrawingImportDraft).not.toHaveBeenCalled();
    expect(parts[0]).toMatchObject({ partNumber: 'P-1', quantity: '12' });
  });
});
