import { describe, expect, it } from 'vitest';
import { clearIntakeDraft, INTAKE_DRAFT_MAX_AGE_MS, intakeDraftKey, readIntakeDraft, writeIntakeDraft } from '../intake-draft';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('intake draft persistence', () => {
  it('round trips a versioned draft and keeps quote/order identities separate', () => {
    const storage = memoryStorage();
    const quote = intakeDraftKey('quote');
    const order = intakeDraftKey('order');
    writeIntakeDraft(storage, quote, { customerId: 'customer-1' }, 1000);
    expect(readIntakeDraft<{ customerId: string }>(storage, quote, 1500)?.data.customerId).toBe('customer-1');
    expect(readIntakeDraft(storage, order, 1500)).toBeNull();
  });
  it('deletes expired, future or corrupt drafts', () => {
    const storage = memoryStorage(); const key = intakeDraftKey('order');
    writeIntakeDraft(storage, key, { value: 1 }, 1000);
    expect(readIntakeDraft(storage, key, 1000 + INTAKE_DRAFT_MAX_AGE_MS + 1)).toBeNull();
    storage.setItem(key, '{bad'); expect(readIntakeDraft(storage, key)).toBeNull();
    writeIntakeDraft(storage, key, { value: 1 }, Date.now() + 120_000);
    expect(readIntakeDraft(storage, key)).toBeNull();
  });
  it('clears a completed draft', () => {
    const storage = memoryStorage(); const key = intakeDraftKey('quote');
    writeIntakeDraft(storage, key, { value: 1 }); clearIntakeDraft(storage, key);
    expect(readIntakeDraft(storage, key)).toBeNull();
  });
});
