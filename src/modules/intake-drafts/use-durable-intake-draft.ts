'use client';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createIntakeDraftTransport } from './durable-intake-draft.client';
import { createDurableIntakeDraftController } from './durable-intake-draft.controller';
import type { DurableIntakeDraftHandle, DurableIntakeDraftHookOptions, IntakeDraftData } from './durable-intake-draft.types';

export function useDurableIntakeDraft<T extends IntakeDraftData>(options: DurableIntakeDraftHookOptions<T>): DurableIntakeDraftHandle<T> {
  const restore = useRef(options.onRestore); restore.current = options.onRestore;
  const { kind, key, legacyStorageKey, debounceMs, enabled = true } = options;
  const binding = useMemo(() => {
    const activity = { active: false };
    const controller = createDurableIntakeDraftController<T>({ kind, key, legacyStorageKey, debounceMs,
      transport: createIntakeDraftTransport<T>(kind, key), canRestore: () => activity.active,
      onRestore: (data) => restore.current(data) });
    return { activity, controller };
  }, [kind, key, legacyStorageKey, debounceMs]);
  const { controller } = binding;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    if (!enabled) return;
    binding.activity.active = true;
    let mounted = true;
    void controller.initialize().then(() => { if (mounted) controller.resume(); });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = controller.getSnapshot();
      if (!current.dirty && !(current.editingBlocked && !current.reloadRequired)) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { mounted = false; binding.activity.active = false; controller.pause(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [binding, controller, enabled]);
  return { ...state, ...(enabled ? {} : { ready: true, dirty: false, status: 'saved' as const, error: null, editingBlocked: false, reloadRequired: false }),
    schedule: controller.schedule, flush: enabled ? controller.flush : async () => true,
    clear: enabled ? controller.clear : async () => true, retry: controller.retry, loadServer: controller.loadServer,
    keepLocal: controller.keepLocal, restoreLegacy: controller.restoreLegacy, discardLegacy: controller.discardLegacy };
}
