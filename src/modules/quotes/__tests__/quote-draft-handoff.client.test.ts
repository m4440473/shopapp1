import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistCreatedQuoteDraft, QUOTE_HANDOFF_READ_TIMEOUT_MS } from '../quote-draft-handoff.client';

const item = { id: 'quote-1', quoteNumber: 'Q-101', updatedAt: '2026-09-11T12:00:00.000Z', workflowStep: 2,
  parts: [{ id: 'saved-part', name: 'Bracket', partNumber: 'B-1' }], attachments: [{ id: 'saved-file', storagePath: 'drawing.pdf' }] };
const snapshot = { form: { quoteNumber: '', companyName: 'Synthetic customer' }, currentStep: 1, furthestStep: 3, activePartKey: 'partial',
  parts: [{ key: 'complete', name: 'Bracket', partNumber: 'B-1', quantity: '2' },
    { key: 'partial', name: '', partNumber: 'P-2', notes: 'Unfinished instructions', reviewWarnings: ['Height unknown'], attachments: [{ storagePath: 'partial.pdf' }] }],
  attachments: [{ storagePath: 'drawing.pdf', label: 'Source drawing' }], pendingSubmission: { key: 'source-key' } };
function envelope(state: 'missing' | 'saved' | 'cleared', data: unknown = null) {
  return { kind: 'quote', key: 'edit:quote-1', ownerId: 'actor-a', revision: state === 'missing' ? 0 : 2, state, data, mutationId: null, updatedAt: null };
}
function fixture(current = envelope('missing')) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/quotes/quote-1') return Response.json({ item });
    if (init?.method === 'GET') return Response.json(current);
    const body = JSON.parse(String(init?.body));
    return Response.json({ ...envelope('saved', body.data), revision: body.expectedRevision + 1, mutationId: body.mutationId });
  });
  return fetcher;
}
afterEach(() => vi.useRealTimers());

describe('created quote draft handoff', () => {
  it('retains partial parts, warnings, attachments and cursor before releasing the creation draft', async () => {
    const fetcher = fixture();
    expect(await persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).toMatchObject({ state: 'saved' });
    const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    const body = JSON.parse(String(write[1]?.body));
    expect(body.expectedRevision).toBe(0);
    expect(body.data.parts[0]).toMatchObject({ persistedId: 'saved-part' });
    expect(body.data.parts[1]).toEqual(snapshot.parts[1]);
    expect(body.data.attachments[0]).toMatchObject({ persistedId: 'saved-file', label: 'Source drawing' });
    expect(body.data).toMatchObject({ activePartKey: 'partial', currentStep: 2, furthestStep: 3, sourceSubmissionKey: 'source-key',
      pendingSubmission: null, baseQuoteUpdatedAt: item.updatedAt, form: { quoteNumber: 'Q-101', companyName: 'Synthetic customer' } });
    expect(write[1]?.headers).toMatchObject({ 'x-shopapp-draft-owner': 'actor-a' });
    expect(fetcher.mock.calls.every(([, init]) => init?.method !== 'DELETE')).toBe(true);
    expect(snapshot.parts[0]).not.toHaveProperty('persistedId');
  });
  it('resumes after a lost write response without overwriting subsequent edits', async () => {
    const fetcher = fixture(envelope('saved', { ...snapshot, sourceSubmissionKey: 'source-key', parts: [{ name: 'A newer edit' }] }));
    expect(await persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).toMatchObject({ state: 'existing' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not resurrect an edit draft that was already cleared', async () => {
    const fetcher = fixture(envelope('cleared'));
    expect(await persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).toMatchObject({ state: 'cleared' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retains the source when another edit draft already exists', async () => {
    const fetcher = fixture(envelope('saved', { ...snapshot, sourceSubmissionKey: 'another-submission' }));
    await expect(persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).rejects.toThrow('different edit draft');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([409, 503])('retains the source when destination acknowledgement fails with %s', async status => {
    const fetcher = fixture();
    fetcher.mockImplementationOnce(async () => Response.json({ item })).mockImplementationOnce(async () => Response.json(envelope('missing')))
      .mockImplementationOnce(async () => Response.json({ error: 'Destination save unconfirmed' }, { status }));
    await expect(persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).rejects.toThrow('Destination save unconfirmed');
    expect(fetcher.mock.calls.every(([, init]) => init?.method !== 'DELETE')).toBe(true);
  });
  it('rejects a changed authenticated owner during the destination write', async () => {
    const fetcher = fixture();
    fetcher.mockImplementationOnce(async () => Response.json({ item })).mockImplementationOnce(async () => Response.json(envelope('missing')))
      .mockImplementationOnce(async (_url, init) => { const body = JSON.parse(String(init?.body)); return Response.json({ ...envelope('saved', body.data), ownerId: 'actor-b', revision: 1, mutationId: body.mutationId }); });
    await expect(persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher as typeof fetch)).rejects.toThrow('account changed');
  });
  it('bounds a stalled quote body without writing or clearing either draft', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => undefined) });
    const result = persistCreatedQuoteDraft('quote-1', snapshot, 'source-key', fetcher);
    const outcome = expect(result).rejects.toThrow('could not be checked');
    await vi.advanceTimersByTimeAsync(QUOTE_HANDOFF_READ_TIMEOUT_MS);
    await outcome;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
