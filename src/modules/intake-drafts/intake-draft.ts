export const INTAKE_DRAFT_VERSION = 1;
export const INTAKE_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60_000;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type DraftEnvelope<T> = {
  version: number;
  updatedAt: number;
  data: T;
};

export function intakeDraftKey(kind: 'quote' | 'order', identity = 'new') {
  return `shopapp:intake-draft:v${INTAKE_DRAFT_VERSION}:${kind}:${identity}`;
}

export function readIntakeDraft<T>(storage: DraftStorage, key: string, now = Date.now()): DraftEnvelope<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
    if (parsed.version !== INTAKE_DRAFT_VERSION || typeof parsed.updatedAt !== 'number' || !('data' in parsed)) {
      storage.removeItem(key);
      return null;
    }
    if (now - parsed.updatedAt > INTAKE_DRAFT_MAX_AGE_MS || parsed.updatedAt > now + 60_000) {
      storage.removeItem(key);
      return null;
    }
    return parsed as DraftEnvelope<T>;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeIntakeDraft<T>(storage: DraftStorage, key: string, data: T, now = Date.now()) {
  storage.setItem(key, JSON.stringify({ version: INTAKE_DRAFT_VERSION, updatedAt: now, data } satisfies DraftEnvelope<T>));
  return now;
}

export function clearIntakeDraft(storage: DraftStorage, key: string) {
  storage.removeItem(key);
}
