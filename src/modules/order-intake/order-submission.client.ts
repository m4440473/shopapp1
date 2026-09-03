import { extractIntakeError } from './order-intake.client';

type FetchClient = typeof fetch;

export type OrderSubmissionResult =
  | { ok: true; orderId: string | null; parts: Array<{ id: string }> }
  | { ok: false; error: string };

async function postOrder(url: string, payload: unknown, idField: 'id' | 'orderId', fallback: string, fetchClient: FetchClient): Promise<OrderSubmissionResult> {
  const response = await fetchClient(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
  if (!response.ok) return { ok: false, error: await extractIntakeError(response, fallback) };
  const data = await response.json().catch(() => null);
  return { ok: true, orderId: typeof data?.[idField] === 'string' ? data[idField] : null, parts: Array.isArray(data?.parts) ? data.parts : [] };
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
