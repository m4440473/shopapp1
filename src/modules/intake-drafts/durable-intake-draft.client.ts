import { DurableIntakeDraftError, type DurableIntakeDraftClear, type DurableIntakeDraftEnvelope, type DurableIntakeDraftWrite, type IntakeDraftData, type IntakeDraftKind } from './durable-intake-draft.types';

export type IntakeDraftTransport<T extends IntakeDraftData> = {
  read: () => Promise<DurableIntakeDraftEnvelope<T>>;
  write: (body: DurableIntakeDraftWrite<T>, ownerId: string) => Promise<DurableIntakeDraftEnvelope<T>>;
  clear: (body: DurableIntakeDraftClear, ownerId: string) => Promise<DurableIntakeDraftEnvelope<T>>;
};
export function createIntakeDraftTransport<T extends IntakeDraftData>(kind: IntakeDraftKind, key: string, fetcher = fetch): IntakeDraftTransport<T> {
  const url = `/api/intake-drafts/${encodeURIComponent(kind)}/${encodeURIComponent(key)}`;
  async function request(method: string, body?: object, ownerId?: string): Promise<DurableIntakeDraftEnvelope<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetcher(url, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(ownerId ? { 'x-shopapp-draft-owner': ownerId } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new DurableIntakeDraftError(typeof result?.error === 'string' ? result.error : 'The draft could not be saved. Your changes are still in this browser.', response.status, result?.current);
      if (!result || result.kind !== kind || result.key !== key || typeof result.ownerId !== 'string'
        || !Number.isSafeInteger(result.revision) || !['missing', 'saved', 'cleared'].includes(result.state)
        || (result.state === 'saved' && (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)))) {
        throw new DurableIntakeDraftError('The server did not confirm the draft save. Retry to check it safely.', 502);
      }
      if (ownerId && result.ownerId !== ownerId) throw new DurableIntakeDraftError('Your signed-in account changed. Your changes are still in this browser.', 403);
      if (body) {
        const mutation = body as DurableIntakeDraftWrite<T> | DurableIntakeDraftClear;
        if (result.mutationId !== mutation.mutationId || result.revision <= mutation.expectedRevision
          || (method === 'PUT' && (result.state !== 'saved' || JSON.stringify(result.data) !== JSON.stringify((mutation as DurableIntakeDraftWrite<T>).data)))
          || (method === 'DELETE' && result.state !== 'cleared')) {
          throw new DurableIntakeDraftError('The server did not confirm this draft change. Retry to check it safely.', 502);
        }
      }
      return result;
    } catch (error) {
      if (error instanceof DurableIntakeDraftError) throw error;
      throw new DurableIntakeDraftError('The server could not be reached. Your changes are still in this browser; retry when connected.', 503);
    } finally { clearTimeout(timer); }
  }
  return { read: () => request('GET'), write: (body, ownerId) => request('PUT', body, ownerId), clear: (body, ownerId) => request('DELETE', body, ownerId) };
}
