import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDurableIntakeDraftController } from '../durable-intake-draft.controller';
import type { IntakeDraftTransport } from '../durable-intake-draft.client';
import { DurableIntakeDraftError, type DurableIntakeDraftClear, type DurableIntakeDraftEnvelope, type DurableIntakeDraftWrite } from '../durable-intake-draft.types';
import { intakeDraftKey, writeIntakeDraft } from '../intake-draft';

type Data = { text: string; imported?: string[] };
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function server(data: Data | null = null) {
  let value: DurableIntakeDraftEnvelope<Data> = { ownerId: 'owner-alice', kind: 'order', key: 'new', revision: data ? 1 : 0,
    state: data ? 'saved' : 'missing', data, updatedAt: data ? new Date().toISOString() : null, mutationId: data ? 'initial-mutation' : null };
  const clone = () => structuredClone(value);
  function fail() { throw new DurableIntakeDraftError('This draft changed in another tab.', 409, clone()); }
  const transport: IntakeDraftTransport<Data> = {
    read: vi.fn(async () => clone()),
    write: vi.fn(async (body: DurableIntakeDraftWrite<Data>, ownerId: string) => {
      if (ownerId !== value.ownerId) throw new DurableIntakeDraftError('Signed-in account changed.', 403);
      if (body.mutationId === value.mutationId && JSON.stringify(body.data) === JSON.stringify(value.data)) return clone();
      if (body.expectedRevision !== value.revision || (value.state === 'cleared' && !body.reactivate)) fail();
      value = { ...value, state: 'saved', revision: value.revision + 1, data: structuredClone(body.data), mutationId: body.mutationId, updatedAt: new Date().toISOString() };
      return clone();
    }),
    clear: vi.fn(async (body: DurableIntakeDraftClear, ownerId: string) => {
      if (ownerId !== value.ownerId) throw new DurableIntakeDraftError('Signed-in account changed.', 403);
      if (body.mutationId === value.mutationId && value.state === 'cleared') return clone();
      if (body.expectedRevision !== value.revision) fail();
      value = { ...value, state: 'cleared', data: null, revision: value.revision + 1, mutationId: body.mutationId, updatedAt: new Date().toISOString() };
      return clone();
    }),
  };
  return { transport, get: clone };
}
const controllers: Array<ReturnType<typeof createDurableIntakeDraftController<Data>>> = [];
afterEach(() => { controllers.splice(0).forEach((controller) => controller.pause()); vi.restoreAllMocks(); });
function controller(transport: IntakeDraftTransport<Data>, local = storage(), clientId = 'tab-one', legacyStorageKey?: string, canRestore?: () => boolean) {
  const restored: Data[] = [];
  const instance = createDurableIntakeDraftController<Data>({ kind: 'order', key: 'new', transport, storage: () => local,
    clientId, legacyStorageKey, canRestore, debounceMs: 100_000, onRestore: (data) => { restored.push(data); } });
  controllers.push(instance); return { instance, local, restored };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }

describe('durable draft browser acknowledgement and recovery', () => {
  it('hydrates the server draft before enabling autosave, without replacing it with the initial empty form', async () => {
    const remote = server({ text: 'Saved server draft' });
    const f = controller(remote.transport);
    f.instance.schedule({ text: 'Initial form' });
    expect(await f.instance.initialize()).toBe(true);
    expect(f.restored).toEqual([{ text: 'Saved server draft' }]);
    expect(f.instance.getSnapshot()).toMatchObject({ ready: true, status: 'saved', dirty: false, revision: 1 });
    expect(remote.transport.write).not.toHaveBeenCalled();
  });

  it('does not acknowledge an import handoff until every edit made during its in-flight save is persisted', async () => {
    const remote = server(); const f = controller(remote.transport); await f.instance.initialize();
    const write = vi.mocked(remote.transport.write).getMockImplementation()!;
    const gates = [deferred(), deferred()]; let call = 0;
    vi.mocked(remote.transport.write).mockImplementation(async (...args) => { await gates[call++].promise; return write(...args); });
    const saved = f.instance.flush({ text: 'Imported', imported: ['a.pdf'] });
    await vi.waitFor(() => expect(remote.transport.write).toHaveBeenCalledTimes(1));
    f.instance.schedule({ text: 'Edited after import', imported: ['a.pdf', 'b.pdf'] });
    gates[0].resolve();
    await vi.waitFor(() => expect(remote.transport.write).toHaveBeenCalledTimes(2));
    expect(f.instance.getSnapshot()).toMatchObject({ status: 'saving', dirty: true, revision: 1 });
    gates[1].resolve(); expect(await saved).toBe(true);
    expect(remote.get().data).toEqual({ text: 'Edited after import', imported: ['a.pdf', 'b.pdf'] });
    expect(f.instance.getSnapshot()).toMatchObject({ status: 'saved', dirty: false, revision: 2 });
  });

  it('retries the same mutation after a lost response and never reports failed authentication as saved', async () => {
    const remote = server(); const f = controller(remote.transport); await f.instance.initialize();
    const write = vi.mocked(remote.transport.write).getMockImplementation()!;
    vi.mocked(remote.transport.write).mockImplementationOnce(async (...args) => { await write(...args); throw new DurableIntakeDraftError('Connection lost after commit', 503); });
    expect(await f.instance.flush({ text: 'Preserve this work' })).toBe(false);
    expect(f.instance.getSnapshot()).toMatchObject({ status: 'error', dirty: true });
    expect([...f.local.values.values()].join('')).toContain('Preserve this work');
    expect(await f.instance.retry()).toBe(true);
    const calls = vi.mocked(remote.transport.write).mock.calls;
    expect(calls[0][0].mutationId).toBe(calls[1][0].mutationId);
    expect(remote.get().revision).toBe(1);
    vi.mocked(remote.transport.write).mockRejectedValueOnce(new DurableIntakeDraftError('Sign in again', 401));
    expect(await f.instance.flush({ text: 'Still here after sign-in expired' })).toBe(false);
    expect(f.instance.getSnapshot()).toMatchObject({ status: 'error', dirty: true });
    expect([...f.local.values.values()].join('')).toContain('Still here after sign-in expired');
  });

  it('recovers browser-only unsaved data after refresh and keeps recovery isolated by authenticated user and tab', async () => {
    const remote = server(); const local = storage();
    const first = controller(remote.transport, local); await first.instance.initialize();
    vi.mocked(remote.transport.write).mockRejectedValueOnce(new DurableIntakeDraftError('Offline', 503));
    expect(await first.instance.flush({ text: 'Unsaved before refresh' })).toBe(false);
    const next = controller(remote.transport, local); await next.instance.initialize();
    expect(next.restored).toEqual([{ text: 'Unsaved before refresh' }]);
    expect(next.instance.getSnapshot()).toMatchObject({ status: 'error', dirty: true });
    const otherTab = controller(remote.transport, local, 'tab-two'); await otherTab.instance.initialize();
    expect(otherTab.restored).toEqual([]);
    expect(await next.instance.retry()).toBe(true);
    expect(remote.get().data?.text).toBe('Unsaved before refresh');
  });

  it('requires a browser-migration decision and never migrates over an existing or cleared server draft', async () => {
    const local = storage(); const legacyKey = intakeDraftKey('order');
    writeIntakeDraft(local, legacyKey, { text: 'Old browser draft' });
    const remote = server(); const f = controller(remote.transport, local, 'migration-tab', legacyKey);
    await f.instance.initialize();
    expect(f.instance.getSnapshot().legacyAvailable).toBe(true);
    expect(await f.instance.flush({ text: 'Initial blank form' })).toBe(false);
    expect(remote.transport.write).not.toHaveBeenCalled();
    expect(await f.instance.restoreLegacy()).toBe(true);
    expect(remote.get().data).toEqual({ text: 'Old browser draft' });
    expect(local.getItem(legacyKey)).toBeNull();
    writeIntakeDraft(local, legacyKey, { text: 'Stale browser data' });
    const newer = controller(remote.transport, local, 'another-tab', legacyKey); await newer.instance.initialize();
    expect(newer.restored).toEqual([{ text: 'Old browser draft' }]);
    expect(newer.instance.getSnapshot().legacyAvailable).toBe(false);
    expect(await newer.instance.clear()).toBe(true);
    writeIntakeDraft(local, legacyKey, { text: 'Cannot revive deleted work' });
    const afterClear = controller(remote.transport, local, 'fresh-tab', legacyKey); await afterClear.instance.initialize();
    expect(afterClear.restored).toEqual([]);
    expect(afterClear.instance.getSnapshot().legacyAvailable).toBe(false);
  });

  it('preserves conflicting tab edits until an explicit keep-local or load-server decision', async () => {
    const remote = server(); const local = storage();
    const first = controller(remote.transport, local, 'A'); const second = controller(remote.transport, local, 'B');
    await Promise.all([first.instance.initialize(), second.instance.initialize()]);
    expect(await first.instance.flush({ text: 'First tab' })).toBe(true);
    expect(await second.instance.flush({ text: 'Second tab pending' })).toBe(false);
    expect(second.instance.getSnapshot()).toMatchObject({ status: 'conflict', dirty: true });
    expect(remote.get().data?.text).toBe('First tab');
    expect(await second.instance.keepLocal()).toBe(true);
    expect(remote.get().data?.text).toBe('Second tab pending');
    expect(await first.instance.flush({ text: 'Older tab again' })).toBe(false);
    vi.mocked(remote.transport.read).mockRejectedValueOnce(new DurableIntakeDraftError('Offline while loading server version', 503));
    expect(await first.instance.loadServer()).toBe(false);
    expect(first.instance.getSnapshot()).toMatchObject({ status: 'conflict', dirty: true });
    expect(await first.instance.loadServer()).toBe(true);
    expect(first.restored.at(-1)?.text).toBe('Second tab pending');
    expect(first.instance.getSnapshot()).toMatchObject({ status: 'saved', dirty: false });
  });

  it('waits for in-flight saves before clearing and cannot resurrect a cleared draft from the old controller', async () => {
    const remote = server(); const first = controller(remote.transport); await first.instance.initialize();
    const stale = controller(remote.transport, first.local, 'stale-tab'); await stale.instance.initialize();
    const write = vi.mocked(remote.transport.write).getMockImplementation()!; const gate = deferred();
    vi.mocked(remote.transport.write).mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
    const save = first.instance.flush({ text: 'Will be discarded' });
    await vi.waitFor(() => expect(remote.transport.write).toHaveBeenCalledTimes(1));
    const clear = first.instance.clear(); gate.resolve(); await save;
    expect(await clear).toBe(true);
    expect(remote.get()).toMatchObject({ state: 'cleared', data: null, revision: 2 });
    expect(await first.instance.flush({ text: 'Late effect must not revive' })).toBe(false);
    expect(await stale.instance.flush({ text: 'Stale tab must not revive' })).toBe(false);
    expect(remote.get().state).toBe('cleared');
    const fresh = controller(remote.transport, first.local, 'fresh-tab'); await fresh.instance.initialize();
    expect(await fresh.instance.flush({ text: 'Intentional next order' })).toBe(true);
    expect(remote.get()).toMatchObject({ revision: 3, data: { text: 'Intentional next order' } });
  });

  it('retains and safely retries an unacknowledged clear after refresh', async () => {
    const remote = server({ text: 'To discard' }); const local = storage();
    const first = controller(remote.transport, local); await first.instance.initialize();
    vi.mocked(remote.transport.clear).mockRejectedValueOnce(new DurableIntakeDraftError('Offline', 503));
    expect(await first.instance.clear()).toBe(false);
    expect(first.instance.getSnapshot()).toMatchObject({ editingBlocked: true, reloadRequired: false, dirty: true });
    first.instance.schedule({ text: 'This form must be disabled until discard finishes' });
    const next = controller(remote.transport, local); await next.instance.initialize();
    expect(next.restored).toEqual([{ text: 'To discard' }]);
    expect(next.instance.getSnapshot()).toMatchObject({ status: 'error', dirty: true, editingBlocked: true, reloadRequired: false });
    expect(await next.instance.retry()).toBe(true);
    expect(remote.get().state).toBe('cleared');
    expect(next.instance.getSnapshot()).toMatchObject({ editingBlocked: true, reloadRequired: true, dirty: false });
    const revisionAfterClear = remote.get().revision;
    expect(await next.instance.clear()).toBe(true);
    expect(remote.get().revision).toBe(revisionAfterClear);
    const fresh = controller(remote.transport, local); await fresh.instance.initialize();
    expect(fresh.instance.getSnapshot()).toMatchObject({ editingBlocked: false, reloadRequired: false });
  });

  it('requires a fresh form when loading a tombstone and preserves local conflict data until that choice', async () => {
    const remote = server({ text: 'Original saved draft' }); const local = storage();
    const first = controller(remote.transport, local, 'A'); const second = controller(remote.transport, local, 'B');
    await Promise.all([first.instance.initialize(), second.instance.initialize()]);
    expect(await first.instance.clear()).toBe(true);
    expect(await second.instance.flush({ text: 'Keep these local edits visible' })).toBe(false);
    expect(await second.instance.loadServer()).toBe(false);
    expect(second.instance.getSnapshot()).toMatchObject({ editingBlocked: true, reloadRequired: true, dirty: true });
    expect([...local.values.values()].join('')).toContain('Keep these local edits visible');
    expect(second.restored.at(-1)).toEqual({ text: 'Original saved draft' });
    expect(await second.instance.retry()).toBe(false);
    expect(remote.get().state).toBe('cleared');
  });

  it('recovers a new draft started after a prior discard when its first save is offline', async () => {
    const remote = server({ text: 'Previous completed order' }); const local = storage();
    const previous = controller(remote.transport, local); await previous.instance.initialize();
    expect(await previous.instance.clear()).toBe(true);
    const fresh = controller(remote.transport, local); await fresh.instance.initialize();
    vi.mocked(remote.transport.write).mockRejectedValueOnce(new DurableIntakeDraftError('Offline', 503));
    expect(await fresh.instance.flush({ text: 'New order work after prior discard' })).toBe(false);
    const refreshed = controller(remote.transport, local); await refreshed.instance.initialize();
    expect(refreshed.restored).toEqual([{ text: 'New order work after prior discard' }]);
    expect(refreshed.instance.getSnapshot()).toMatchObject({ dirty: true, status: 'error', editingBlocked: false });
    expect(await refreshed.instance.retry()).toBe(true);
    expect(remote.get()).toMatchObject({ state: 'saved', data: { text: 'New order work after prior discard' } });
  });

  it('does not hydrate an abandoned controller into a different form and can initialize after StrictMode resumes', async () => {
    const remote = server({ text: 'Quote A draft' }); const gate = deferred(); let active = true;
    const read = vi.mocked(remote.transport.read).getMockImplementation()!;
    vi.mocked(remote.transport.read).mockImplementationOnce(async () => { await gate.promise; return read(); });
    const first = controller(remote.transport, storage(), 'A', undefined, () => active);
    const initializing = first.instance.initialize();
    active = false; gate.resolve();
    expect(await initializing).toBe(false);
    expect(first.restored).toEqual([]);
    expect(first.instance.getSnapshot().ready).toBe(false);
    active = true;
    expect(await first.instance.initialize()).toBe(true);
    expect(first.restored).toEqual([{ text: 'Quote A draft' }]);
    expect(first.instance.getSnapshot().ready).toBe(true);

    const reloadGate = deferred();
    vi.mocked(remote.transport.read).mockImplementationOnce(async () => { await reloadGate.promise; return read(); });
    const reloading = first.instance.loadServer(); active = false; reloadGate.resolve();
    expect(await reloading).toBe(false);
    expect(first.restored).toHaveLength(1);
  });
});
