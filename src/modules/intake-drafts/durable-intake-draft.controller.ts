import { readIntakeDraft } from './intake-draft';
import type { IntakeDraftTransport } from './durable-intake-draft.client';
import { DurableIntakeDraftError, type DurableIntakeDraftClear, type DurableIntakeDraftEnvelope, type DurableIntakeDraftState, type DurableIntakeDraftWrite, type IntakeDraftData, type IntakeDraftKind } from './durable-intake-draft.types';

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Options<T extends IntakeDraftData> = {
  kind: IntakeDraftKind; key: string; transport: IntakeDraftTransport<T>; onRestore: (data: T) => void;
  storage?: () => DraftStorage | undefined; clientId?: string; legacyStorageKey?: string; debounceMs?: number;
  canRestore?: () => boolean;
};
type Backup<T> = { version: 1; baseRevision: number; data: T; pending?: DurableIntakeDraftWrite<T & IntakeDraftData>; clear?: DurableIntakeDraftClear };

export function newIntakeDraftMutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function browserTabId() {
  try {
    const key = 'shopapp:intake-draft:tab';
    const saved = globalThis.sessionStorage?.getItem(key);
    if (saved) return saved;
    const id = newIntakeDraftMutationId(); globalThis.sessionStorage?.setItem(key, id); return id;
  } catch { return newIntakeDraftMutationId(); }
}

/** Owns save acknowledgement and recovery; it never treats an HTTP attempt as a successful save. */
export function createDurableIntakeDraftController<T extends IntakeDraftData>(options: Options<T>) {
  let state: DurableIntakeDraftState = { ready: false, status: 'loading', dirty: false, savedAt: null, revision: 0, error: null, legacyAvailable: false, editingBlocked: false, reloadRequired: false };
  const listeners = new Set<() => void>();
  let remote: DurableIntakeDraftEnvelope<T> | null = null;
  let conflict: DurableIntakeDraftEnvelope<T> | null = null;
  let latest: T | null = null;
  let acknowledged: string | null = null;
  let pending: DurableIntakeDraftWrite<T> | null = null;
  let pendingClear: DurableIntakeDraftClear | null = null;
  let legacy: T | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flight: Promise<boolean> | null = null;
  let initialization: Promise<boolean> | null = null;
  let clientId = options.clientId;

  const emit = (patch: Partial<DurableIntakeDraftState>) => {
    state = { ...state, ...patch }; for (const listener of listeners) listener();
  };
  const storage = () => { try { return options.storage?.() ?? globalThis.localStorage; } catch { return undefined; } };
  const backupKey = () => remote ? `shopapp:durable-draft:v1:${encodeURIComponent(remote.ownerId)}:${options.kind}:${encodeURIComponent(options.key)}:${clientId ??= browserTabId()}` : null;
  const cancelTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  function backup() {
    const key = backupKey(); if (!key || !latest) return;
    try {
      const target = storage();
      if (!target) throw new Error('Storage unavailable');
      target.setItem(key, JSON.stringify({ version: 1, baseRevision: remote!.revision, data: latest,
        ...(pending ? { pending } : {}), ...(pendingClear ? { clear: pendingClear } : {}) } satisfies Backup<T>));
    } catch { emit({ error: 'Browser backup is unavailable. Keep this page open until the server confirms the save.' }); }
  }
  function removeBackup() { const key = backupKey(); if (key) { try { storage()?.removeItem(key); } catch { /* Server acknowledgement remains authoritative. */ } } }
  function savedEnvelope(value: DurableIntakeDraftEnvelope<T>) {
    if (remote && value.ownerId !== remote.ownerId) throw new DurableIntakeDraftError('Your signed-in account changed. Reload before saving.', 403);
    remote = value;
    emit({ revision: value.revision, savedAt: value.updatedAt ? Date.parse(value.updatedAt) : null });
  }
  function failed(error: unknown) {
    if (error instanceof DurableIntakeDraftError && error.status === 409 && error.current?.ownerId === remote?.ownerId) {
      conflict = error.current as DurableIntakeDraftEnvelope<T>;
      emit({ status: 'conflict', dirty: true, error: error.message });
    } else emit({ status: conflict ? 'conflict' : 'error', error: error instanceof Error ? error.message : 'The draft was not saved. Keep this page open and retry.' });
    backup(); return false;
  }
  function scheduleTimer() {
    cancelTimer();
    if (!closed && !state.legacyAvailable && !conflict && state.dirty) {
      timer = setTimeout(() => { timer = null; void flush(); }, options.debounceMs ?? 800);
    }
  }
  function hydrate(data: T) {
    latest = JSON.parse(JSON.stringify(data)) as T;
    options.onRestore(latest);
  }
  async function initializeNow() {
    try {
      const value = await options.transport.read();
      if (options.canRestore?.() === false) { initialization = null; return false; }
      savedEnvelope(value);
      const key = backupKey();
      let cached: Backup<T> | null = null;
      try {
        const raw = key ? storage()?.getItem(key) : null;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.version === 1 && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) && Number.isSafeInteger(parsed.baseRevision)) cached = parsed;
      } catch { /* A broken local backup cannot replace a valid server draft. */ }
      acknowledged = value.data ? JSON.stringify(value.data) : null;
      if (value.state === 'cleared' && !(cached && !cached.clear && cached.baseRevision === value.revision)) {
        // Expire work from before the discard, but retain a new draft started at this tombstone revision.
        removeBackup(); latest = null;
      } else if (cached && (cached.clear || JSON.stringify(cached.data) !== acknowledged)) {
        hydrate(cached.data); pending = cached.pending ?? null; pendingClear = cached.clear ?? null;
        if (pendingClear) { closed = true; emit({ editingBlocked: true }); }
        if (cached.baseRevision !== value.revision && pending?.mutationId !== value.mutationId) {
          conflict = value;
          emit({ ready: true, status: 'conflict', dirty: true, error: 'This browser has unsaved changes and the server draft changed. Choose which version to keep.' });
          return true;
        }
        if (pending?.mutationId === value.mutationId) pending = null;
        emit({ ready: true, status: 'error', dirty: true, error: pendingClear ? 'Discard was not confirmed. Retry to finish discarding this draft.' : 'Recovered unsaved browser changes. Retry to save them to the server.' });
        return true;
      } else if (value.data) { hydrate(value.data); removeBackup(); }
      else if (value.state === 'missing' && options.legacyStorageKey) {
        const target = storage(); const prior = target ? readIntakeDraft<T>(target, options.legacyStorageKey) : null;
        if (prior?.data && typeof prior.data === 'object' && !Array.isArray(prior.data)) legacy = prior.data;
      }
      emit({ ready: true, status: 'saved', dirty: false, error: null, legacyAvailable: Boolean(legacy) });
      return true;
    } catch (error) { return failed(error); }
  }
  function initialize() { return initialization ??= initializeNow(); }

  function schedule(data: T) {
    if (!state.ready || closed) return;
    let serialized: string;
    try { serialized = JSON.stringify(data); } catch { emit({ status: 'error', dirty: true, error: 'The draft contains data that cannot be saved.' }); return; }
    if (latest && serialized === JSON.stringify(latest)) return;
    latest = JSON.parse(serialized) as T;
    const dirty = serialized !== acknowledged || Boolean(pending);
    emit({ dirty, status: conflict ? 'conflict' : flight ? 'saving' : dirty ? 'dirty' : 'saved', ...(conflict ? {} : { error: null }) });
    if (dirty) { backup(); scheduleTimer(); } else removeBackup();
  }
  async function drain() {
    try {
      while (!closed && latest && remote && (JSON.stringify(latest) !== acknowledged || pending)) {
        if (conflict || state.legacyAvailable) return false;
        pending ??= { expectedRevision: remote.revision, mutationId: newIntakeDraftMutationId(), data: latest,
          ...(remote.state === 'cleared' ? { reactivate: true } : {}) };
        backup(); emit({ status: 'saving', dirty: true, error: null });
        const sent = pending;
        const result = await options.transport.write(sent, remote.ownerId);
        savedEnvelope(result);
        acknowledged = JSON.stringify(sent.data); pending = null;
        const dirty = JSON.stringify(latest) !== acknowledged;
        emit({ status: dirty ? 'dirty' : 'saved', dirty, error: null });
        if (dirty) backup(); else removeBackup();
      }
      if (!closed && latest && !pending && JSON.stringify(latest) === acknowledged) emit({ status: 'saved', dirty: false, error: null });
      return !state.dirty;
    } catch (error) { return failed(error); }
  }
  async function flush(data?: T) {
    if (data) schedule(data);
    cancelTimer();
    if (!state.ready || closed || conflict || state.legacyAvailable) {
      if (state.legacyAvailable) emit({ error: 'Restore or discard the browser draft before saving this form.' });
      return false;
    }
    if (flight) {
      const saved = await flight;
      return saved && state.dirty ? flush() : saved;
    }
    flight = drain().finally(() => { flight = null; });
    return flight;
  }
  async function clear() {
    cancelTimer();
    if (state.reloadRequired && remote?.state === 'cleared' && latest === null) return true;
    if (!state.ready || !remote || conflict || state.reloadRequired) return false;
    closed = true;
    emit({ editingBlocked: true, status: 'saving', dirty: true, error: null });
    if (flight) await flight;
    pendingClear ??= { expectedRevision: remote.revision, mutationId: newIntakeDraftMutationId() };
    backup(); emit({ status: 'saving', dirty: true, error: null });
    try {
      const value = await options.transport.clear(pendingClear, remote.ownerId);
      savedEnvelope(value); pending = null; pendingClear = null; latest = null; acknowledged = null; legacy = null;
      removeBackup();
      if (options.legacyStorageKey) { try { storage()?.removeItem(options.legacyStorageKey); } catch { /* Tombstone prevents restoring it. */ } }
      emit({ status: 'saved', dirty: false, error: null, legacyAvailable: false, reloadRequired: true });
      return true;
    } catch (error) { return failed(error); }
  }
  async function retry() {
    if (state.reloadRequired) return false;
    if (!state.ready) { initialization = null; return initialize(); }
    if (pendingClear) return clear();
    return flush();
  }
  async function loadServer() {
    cancelTimer(); if (flight) await flight;
    try {
      const value = await options.transport.read();
      if (options.canRestore?.() === false) return false;
      savedEnvelope(value);
      if (!value.data) {
        closed = true;
        emit({ status: 'error', editingBlocked: true, reloadRequired: true, error: 'This draft was cleared in another tab. Start a new draft to continue; your local changes remain here until then.' });
        return false;
      }
      hydrate(value.data); acknowledged = JSON.stringify(value.data); conflict = null; pending = null; pendingClear = null; closed = false;
      removeBackup(); emit({ status: 'saved', dirty: false, error: null, editingBlocked: false, reloadRequired: false }); return true;
    } catch (error) { return failed(error); }
  }
  async function keepLocal() {
    if (!conflict || !latest) return false;
    savedEnvelope(conflict); conflict = null; pending = null; pendingClear = null; closed = false;
    acknowledged = remote!.data ? JSON.stringify(remote!.data) : null;
    emit({ dirty: true, status: 'dirty', error: null, editingBlocked: false, reloadRequired: false }); backup();
    return flush();
  }
  async function restoreLegacy() {
    if (!legacy || !remote || remote.state !== 'missing') return false;
    const value = legacy; legacy = null; hydrate(value);
    emit({ legacyAvailable: false, dirty: true, status: 'dirty', error: null }); backup();
    const saved = await flush();
    if (saved && options.legacyStorageKey) { try { storage()?.removeItem(options.legacyStorageKey); } catch { /* Server now owns the restored draft. */ } }
    return saved;
  }
  function discardLegacy() {
    legacy = null;
    if (options.legacyStorageKey) { try { storage()?.removeItem(options.legacyStorageKey); } catch { /* The server save will supersede this legacy entry. */ } }
    emit({ legacyAvailable: false, error: null }); scheduleTimer();
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize, schedule, flush, clear, retry, loadServer, keepLocal, restoreLegacy, discardLegacy,
    pause: cancelTimer, resume: () => { if (state.status === 'dirty') scheduleTimer(); },
  };
}
