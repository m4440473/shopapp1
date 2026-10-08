import { extractIntakeError } from './order-intake.client';

type FetchClient = typeof fetch;

export const ORDER_SUBMISSION_TIMEOUT_MS = 120_000;
export const ORDER_SUBMISSION_UNCONFIRMED_MESSAGE = 'ShopApp could not confirm whether the order was created. Check Orders before trying again. Your entries have been kept.';

export type OrderSubmissionResult =
  | { ok: true; orderId: string; parts: Array<{ id: string }> }
  | { ok: false; error: string };

async function postOrder(url: string, payload: unknown, idField: 'id' | 'orderId', fallback: string, fetchClient: FetchClient): Promise<OrderSubmissionResult> {
  const controller = new AbortController();
  const unconfirmed = (): OrderSubmissionResult => ({ ok: false, error: ORDER_SUBMISSION_UNCONFIRMED_MESSAGE });
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<OrderSubmissionResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(unconfirmed());
    }, ORDER_SUBMISSION_TIMEOUT_MS);
  });
  try {
    const request = async (): Promise<OrderSubmissionResult> => {
      const response = await fetchClient(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, error: await extractIntakeError(response, fallback) };
      const data = await response.json().catch(() => null);
      if (typeof data?.[idField] !== 'string' || !data[idField].trim()) return unconfirmed();
      return { ok: true, orderId: data[idField], parts: Array.isArray(data?.parts) ? data.parts : [] };
    };
    // Bound both response headers and body; aborting a POST never proves it was rolled back.
    return await Promise.race([request(), deadline]);
  } catch {
    return unconfirmed();
  } finally {
    clearTimeout(timer);
  }
}

export function submitDirectOrder(payload: unknown, fetchClient: FetchClient = fetch) {
  return postOrder('/api/orders', payload, 'id', 'Error creating order. Please try again.', fetchClient);
}

export function submitQuoteConversion(quoteId: string, payload: unknown, fetchClient: FetchClient = fetch) {
  return postOrder(`/api/admin/quotes/${quoteId}/convert`, payload, 'orderId', 'Conversion failed. Please try again.', fetchClient);
}

export function submitRepeatOrder(templateId: string, payload: unknown, fetchClient: FetchClient = fetch) {
  return postOrder(`/api/repeat-order-templates/${templateId}/create-order`, payload, 'id', 'Repeat-order creation failed. Please try again.', fetchClient);
}
