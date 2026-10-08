export type IntakeDraftKind = 'order' | 'quote';
export type IntakeDraftData = Record<string, unknown>;
export const INTAKE_DRAFT_MAX_BYTES = 2 * 1024 * 1024;

export type DurableIntakeDraftEnvelope<T extends IntakeDraftData = IntakeDraftData> = {
  ownerId: string;
  kind: IntakeDraftKind;
  key: string;
  revision: number;
  state: 'missing' | 'saved' | 'cleared';
  data: T | null;
  updatedAt: string | null;
  mutationId: string | null;
};

export type DurableIntakeDraftWrite<T extends IntakeDraftData = IntakeDraftData> = {
  expectedRevision: number;
  mutationId: string;
  data: T;
  reactivate?: boolean;
};
export type DurableIntakeDraftClear = { expectedRevision: number; mutationId: string };
export type DurableIntakeDraftStatus = 'loading' | 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export type DurableIntakeDraftState = {
  ready: boolean;
  status: DurableIntakeDraftStatus;
  dirty: boolean;
  savedAt: number | null;
  revision: number;
  error: string | null;
  legacyAvailable: boolean;
  /** The old form must remain frozen while its discard is uncertain or complete. */
  editingBlocked: boolean;
  /** A fresh controller/page is required after accepting a tombstone. */
  reloadRequired: boolean;
};

export type DurableIntakeDraftHookOptions<T extends IntakeDraftData> = {
  kind: IntakeDraftKind;
  key: string;
  enabled?: boolean;
  legacyStorageKey?: string;
  debounceMs?: number;
  onRestore: (data: T) => void;
};

export type DurableIntakeDraftHandle<T extends IntakeDraftData> = DurableIntakeDraftState & {
  schedule: (data: T) => void;
  flush: (data?: T) => Promise<boolean>;
  clear: () => Promise<boolean>;
  retry: () => Promise<boolean>;
  loadServer: () => Promise<boolean>;
  keepLocal: () => Promise<boolean>;
  restoreLegacy: () => Promise<boolean>;
  discardLegacy: () => void;
};

export class DurableIntakeDraftError extends Error {
  constructor(message: string, public status = 400, public current?: DurableIntakeDraftEnvelope) {
    super(message);
  }
}
