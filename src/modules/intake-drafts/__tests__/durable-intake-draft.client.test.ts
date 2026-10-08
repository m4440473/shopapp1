import { describe, expect, it, vi } from 'vitest';
import { createIntakeDraftTransport } from '../durable-intake-draft.client';

const saved = { ownerId: 'alice', kind: 'quote', key: 'edit:123', revision: 2, state: 'saved', data: { text: 'Save this' }, updatedAt: new Date().toISOString(), mutationId: 'save-unique-id' };
const body = { expectedRevision: 1, mutationId: saved.mutationId, data: saved.data };
describe('draft browser request boundary', () => {
  it('binds writes to the loaded account, uses no-store and waits for the matching save acknowledgement', async () => {
    const fetcher = vi.fn(async () => Response.json(saved));
    const transport = createIntakeDraftTransport('quote', 'edit:123', fetcher);
    expect(await transport.write(body, 'alice')).toEqual(saved);
    expect(fetcher.mock.calls[0]).toMatchObject(['/api/intake-drafts/quote/edit%3A123', {
      method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'x-shopapp-draft-owner': 'alice', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }]);
  });
  it('rejects apparently successful responses for another mutation, draft, owner or data', async () => {
    for (const change of [{ mutationId: 'someone-elses-save' }, { key: 'new' }, { ownerId: 'bob' }, { data: { text: 'Different' } }, { revision: 1 }]) {
      const transport = createIntakeDraftTransport('quote', 'edit:123', vi.fn(async () => Response.json({ ...saved, ...change })));
      await expect(transport.write(body, 'alice')).rejects.toBeInstanceOf(Error);
    }
  });
  it('returns conflict details and distinguishes auth failure from network failure', async () => {
    const conflict = createIntakeDraftTransport('quote', 'edit:123', vi.fn(async () => Response.json({ error: 'Changed in another tab', current: saved }, { status: 409 })));
    await expect(conflict.write(body, 'alice')).rejects.toMatchObject({ status: 409, current: saved });
    const auth = createIntakeDraftTransport('quote', 'edit:123', vi.fn(async () => Response.json({ error: 'Sign in' }, { status: 401 })));
    await expect(auth.write(body, 'alice')).rejects.toMatchObject({ status: 401 });
    const offline = createIntakeDraftTransport('quote', 'edit:123', vi.fn(async () => { throw new Error('connection reset'); }));
    await expect(offline.write(body, 'alice')).rejects.toMatchObject({ status: 503 });
  });
});
