import { afterEach, describe, expect, it, vi } from 'vitest';

import { ORDER_SUBMISSION_TIMEOUT_MS, ORDER_SUBMISSION_UNCONFIRMED_MESSAGE, submitDirectOrder, submitQuoteConversion, submitRepeatOrder } from '../order-submission.client';

afterEach(() => vi.useRealTimers());

describe('new-order mode submission clients', () => {
  it.each([
    ['direct', '/api/orders', 'id', (fetchClient: typeof fetch) => submitDirectOrder({ part: 1 }, fetchClient)],
    ['conversion', '/api/admin/quotes/quote-1/convert', 'orderId', (fetchClient: typeof fetch) => submitQuoteConversion('quote-1', { part: 1 }, fetchClient)],
    ['repeat', '/api/repeat-order-templates/template-1/create-order', 'id', (fetchClient: typeof fetch) => submitRepeatOrder('template-1', { part: 1 }, fetchClient)],
  ] as const)('keeps the %s route and response identity explicit', async (_name, expectedUrl, idField, submit) => {
    const fetchClient = vi.fn(async () => new Response(JSON.stringify({ [idField]: 'order-1', parts: [{ id: 'part-1' }] }), { status: 200 })) as unknown as typeof fetch;
    const result = await submit(fetchClient);
    expect(result).toEqual({ ok: true, orderId: 'order-1', parts: [{ id: 'part-1' }] });
    const [url, options] = vi.mocked(fetchClient).mock.calls[0];
    expect(url).toBe(expectedUrl);
    expect(options).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('returns the server validation message without routing or mode-specific UI effects', async () => {
    const fetchClient = vi.fn(async () => new Response(JSON.stringify({ error: 'Contact does not belong to customer.' }), { status: 400 }));
    await expect(submitQuoteConversion('quote-1', {}, fetchClient as any)).resolves.toEqual({ ok: false, error: 'Contact does not belong to customer.' });
  });

  it.each([submitDirectOrder, (payload: unknown, fetchClient: typeof fetch) => submitQuoteConversion('quote-1', payload, fetchClient), (payload: unknown, fetchClient: typeof fetch) => submitRepeatOrder('template-1', payload, fetchClient)])('returns an uncertain outcome after network failure without retrying', async (submit) => {
    const fetchClient = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submit({}, fetchClient)).resolves.toEqual({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
    expect(fetchClient).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { id: '' }, { id: '   ' }])('does not report success without a usable created-order identity: %j', async (body) => {
    const fetchClient = vi.fn(async () => new Response(JSON.stringify(body), { status: 201 }));
    await expect(submitDirectOrder({}, fetchClient)).resolves.toEqual({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
  });

  it('preserves uncertainty when a successful HTTP response has unreadable JSON', async () => {
    const fetchClient = vi.fn(async () => new Response('upstream connection lost', { status: 201 }));
    await expect(submitDirectOrder({}, fetchClient)).resolves.toEqual({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
  });

  it('expires a stalled request, aborts it and never repeats the POST', async () => {
    vi.useFakeTimers();
    const fetchClient = vi.fn(() => new Promise<Response>(() => undefined));
    const pending = submitDirectOrder({}, fetchClient);
    const signal = (fetchClient.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
    await vi.advanceTimersByTimeAsync(ORDER_SUBMISSION_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
    expect(signal?.aborted).toBe(true);
    expect(fetchClient).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies the same deadline to a stalled response body and consumes its late rejection', async () => {
    vi.useFakeTimers();
    let rejectBody!: (error: Error) => void;
    const json = vi.fn(() => new Promise((_resolve, reject) => { rejectBody = reject; }));
    const fetchClient = vi.fn(async () => ({ ok: true, json } as unknown as Response));
    const pending = submitDirectOrder({}, fetchClient);
    await vi.advanceTimersByTimeAsync(ORDER_SUBMISSION_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
    rejectBody(new Error('Connection closed after timeout'));
    await Promise.resolve();
    expect(fetchClient).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the deadline after a successful creation', async () => {
    vi.useFakeTimers();
    const fetchClient = vi.fn(async () => new Response(JSON.stringify({ id: 'order-1' }), { status: 201 }));
    await expect(submitDirectOrder({}, fetchClient)).resolves.toMatchObject({ ok: true, orderId: 'order-1' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
