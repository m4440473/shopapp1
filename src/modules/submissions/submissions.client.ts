import type { CreationSubmissionScope } from './submissions.types';

export type PendingCreationSubmission = { version: 1; key: string; scope: CreationSubmissionScope; url: string; payload: unknown };
export type CreationSubmissionResult =
  | { state: 'created'; id: string; response: Record<string, unknown> }
  | { state: 'rejected'; error: string; status: number }
  | { state: 'unknown'; error: string; status?: number };

export const SUBMISSION_TIMEOUT_MS = 120_000;
export const SUBMISSION_LOOKUP_TIMEOUT_MS = 15_000;

async function boundedRequest(timeout: number, request: (signal: AbortSignal) => Promise<CreationSubmissionResult>, error: string): Promise<CreationSubmissionResult> {
  const controller = new AbortController();
  const unknown: CreationSubmissionResult = { state: 'unknown', error };
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<CreationSubmissionResult>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(unknown); }, timeout);
  });
  try { return await Promise.race([request(controller.signal), deadline]); }
  catch { return unknown; }
  finally { clearTimeout(timer); }
}

function randomSubmissionKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createPendingCreationSubmission(scope: CreationSubmissionScope, url: string, payload: unknown): PendingCreationSubmission {
  return { version: 1, key: randomSubmissionKey(), scope, url, payload: JSON.parse(JSON.stringify(payload)) };
}
export function parsePendingCreationSubmission(value: unknown, expectedScope: CreationSubmissionScope, expectedUrl: string): PendingCreationSubmission | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pending = value as Partial<PendingCreationSubmission>;
  if (pending.version !== 1 || typeof pending.key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pending.key)
    || pending.scope !== expectedScope || pending.url !== expectedUrl
    || !pending.payload || typeof pending.payload !== 'object' || Array.isArray(pending.payload)) return null;
  return pending as PendingCreationSubmission;
}
function createdId(body: Record<string, unknown>) {
  const item = body.item && typeof body.item === 'object' ? body.item as Record<string, unknown> : null;
  const id = body.orderId ?? body.id ?? item?.id;
  return typeof id === 'string' && id.trim() ? id : null;
}
function message(body: Record<string, unknown> | null, fallback: string) {
  if (typeof body?.error === 'string') return body.error;
  if (body?.error && typeof body.error === 'object') {
    const issues = body.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const details = [...(issues.formErrors ?? []), ...Object.entries(issues.fieldErrors ?? {}).flatMap(([field, values]) => values.map(value => `${field}: ${value}`))];
    if (details.length) return details.join('\n');
  }
  return fallback;
}

/** Caller must durably save this exact envelope before invoking the POST. Never rotates its key. */
export async function submitPendingCreationSubmission(pending: PendingCreationSubmission, fetcher: typeof fetch = fetch): Promise<CreationSubmissionResult> {
  return boundedRequest(SUBMISSION_TIMEOUT_MS, async signal => {
    const response = await fetcher(pending.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.key }, body: JSON.stringify(pending.payload), signal });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const id = body && createdId(body);
    if (response.ok && id) return { state: 'created', id, response: body! };
    const error = message(body, [401, 403].includes(response.status)
      ? 'Sign in with the same account and check the saved submission. Its earlier result is still unconfirmed.'
      : 'The save result is unconfirmed. Keep this draft and retry the saved submission.');
    return [400, 422].includes(response.status)
      ? { state: 'rejected', error, status: response.status }
      : { state: 'unknown', error, status: response.status };
  }, 'Connection interrupted or timed out. Your submission is saved; check its result or retry it.');
}

export async function lookupPendingCreationSubmission(pending: PendingCreationSubmission, fetcher: typeof fetch = fetch): Promise<CreationSubmissionResult> {
  return boundedRequest(SUBMISSION_LOOKUP_TIMEOUT_MS, async signal => {
    const query = new URLSearchParams({ scope: pending.scope, key: pending.key });
    const response = await fetcher(`/api/submissions/status?${query}`, { cache: 'no-store', signal });
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const id = body && createdId(body);
    if (response.ok && body?.state === 'created' && id) return { state: 'created', id, response: body };
    return { state: 'unknown', error: message(body, 'No completed result is confirmed yet. Retry the saved submission.'), status: response.status };
  }, 'Cannot check the save result right now. Keep this draft and try again.');
}
