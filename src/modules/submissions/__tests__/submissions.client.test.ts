import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPendingCreationSubmission, lookupPendingCreationSubmission, parsePendingCreationSubmission, submitPendingCreationSubmission, SUBMISSION_TIMEOUT_MS, SUBMISSION_LOOKUP_TIMEOUT_MS } from '../submissions.client';

afterEach(() => vi.useRealTimers());

describe('saved submission transport', () => {
  it('creates cryptographic UUIDs on LAN HTTP without crypto.randomUUID and validates restored envelopes', () => {
    const sourceCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: sourceCrypto.getRandomValues.bind(sourceCrypto) });
    try {
      const pending = createPendingCreationSubmission('order:create', '/api/orders', { parts: [] });
      expect(parsePendingCreationSubmission(JSON.parse(JSON.stringify(pending)), 'order:create', '/api/orders')).toEqual(pending);
      expect(createPendingCreationSubmission('order:create', '/api/orders', {}).key).not.toBe(pending.key);
      for (const invalid of [{ ...pending, version: 2 }, { ...pending, key: 'bad' }, { ...pending, url: '/api/other' }, { ...pending, scope: 'quote:create' }, { ...pending, payload: [] }, { ...pending, payload: null }]) {
        expect(parsePendingCreationSubmission(invalid, 'order:create', '/api/orders')).toBeNull();
      }
    } finally { vi.unstubAllGlobals(); }
  });
  it('freezes the pending payload and reuses its key after an ambiguous server failure', async () => {
    const form = { parts: [{ quantity: 2 }] };
    const pending = createPendingCreationSubmission('order:create', '/api/orders', form);
    form.parts[0].quantity = 99;
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(Response.json({ id: 'original-order' }, { status: 201 }));
    expect(await submitPendingCreationSubmission(pending, fetcher)).toMatchObject({ state: 'unknown' });
    expect(await submitPendingCreationSubmission(pending, fetcher)).toMatchObject({ state: 'created', id: 'original-order' });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ ...fetcher.mock.calls[1][1], signal: expect.any(AbortSignal) });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ parts: [{ quantity: 2 }] });
    expect(fetcher.mock.calls[1][1].headers['Idempotency-Key']).toBe(pending.key);
  });
  it.each([400, 422])('marks definitive prewrite rejection %i as editable', async status => {
    expect(await submitPendingCreationSubmission(createPendingCreationSubmission('quote:create', '/api/admin/quotes', {}), vi.fn().mockResolvedValue(Response.json({ error: 'Fix this field' }, { status })))).toMatchObject({ state: 'rejected', status });
  });
  it.each([401, 403, 404, 409, 500, 502, 503])('retains pending state after ambiguous HTTP %i', async status => {
    expect(await submitPendingCreationSubmission(createPendingCreationSubmission('quote:create', '/api/admin/quotes', {}), vi.fn().mockResolvedValue(new Response('', { status })))).toMatchObject({ state: 'unknown', status });
  });
  it('keeps an unreadable success response unresolved and only uses GET when checking completion', async () => {
    const pending = createPendingCreationSubmission('quote:create', '/api/admin/quotes', {});
    expect(await submitPendingCreationSubmission(pending, vi.fn().mockResolvedValue(new Response('broken', { status: 200 })))).toMatchObject({ state: 'unknown' });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ state: 'created', id: 'saved-quote' }));
    expect(await lookupPendingCreationSubmission(pending, fetcher)).toMatchObject({ state: 'created', id: 'saved-quote' });
    expect(fetcher.mock.calls[0][0]).toContain('/api/submissions/status?');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });
  it.each(['headers', 'body'] as const)('bounds stalled POST %s, retains the same saved key and consumes a late failure', async stage => {
    vi.useFakeTimers();
    let rejectRequest!: (error: Error) => void;
    const stalled = new Promise<Response>((_resolve, reject) => { rejectRequest = reject; });
    const fetcher = vi.fn().mockImplementation(() => stage === 'headers' ? stalled : Promise.resolve({ ok: true, status: 201, json: () => stalled }));
    const pending = createPendingCreationSubmission('order:create', '/api/orders', {});
    const result = submitPendingCreationSubmission(pending, fetcher);
    await vi.advanceTimersByTimeAsync(SUBMISSION_TIMEOUT_MS);
    expect(await result).toMatchObject({ state: 'unknown' });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(pending.key);
    expect(fetcher).toHaveBeenCalledTimes(1);
    rejectRequest(new Error('Late response failure'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a stalled status lookup without sending any POST', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => undefined));
    const result = lookupPendingCreationSubmission(createPendingCreationSubmission('order:create', '/api/orders', {}), fetcher);
    await vi.advanceTimersByTimeAsync(SUBMISSION_LOOKUP_TIMEOUT_MS);
    expect(await result).toMatchObject({ state: 'unknown' });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
