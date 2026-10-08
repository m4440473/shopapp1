import 'server-only';
import { compareAndSwapIntakeDraft, findDurableIntakeDraft, type IntakeDraftOwnerKey, type StoredIntakeDraft } from './durable-intake-draft.repo';
import { IntakeDraftClear, IntakeDraftIdentity, IntakeDraftWrite, serializeIntakeDraft } from './durable-intake-draft.schema';
import { DurableIntakeDraftError, type DurableIntakeDraftEnvelope } from './durable-intake-draft.types';

function identity(userId: string, kind: string, key: string): IntakeDraftOwnerKey {
  if (!userId) throw new DurableIntakeDraftError('Sign in to save your draft.', 401);
  const parsed = IntakeDraftIdentity.safeParse({ kind, key });
  if (!parsed.success) throw new DurableIntakeDraftError('Invalid draft identity.');
  return { userId, ...parsed.data };
}
function envelope(owner: IntakeDraftOwnerKey, row: StoredIntakeDraft | null): DurableIntakeDraftEnvelope {
  return { ownerId: owner.userId, kind: owner.kind, key: owner.key, revision: row?.revision ?? 0,
    state: !row ? 'missing' : row.clearedAt ? 'cleared' : 'saved',
    data: row?.dataJson ? JSON.parse(row.dataJson) : null, updatedAt: row?.updatedAt.toISOString() ?? null,
    mutationId: row?.lastMutationId ?? null };
}
export async function getDurableIntakeDraft(userId: string, kind: string, key: string) {
  const owner = identity(userId, kind, key);
  return envelope(owner, await findDurableIntakeDraft(owner));
}
async function mutateDraft(owner: IntakeDraftOwnerKey, input: {
  expectedRevision: number; mutationId: string; dataJson: string | null; reactivate?: boolean;
}) {
  const previous = await findDurableIntakeDraft(owner);
  if (previous?.lastMutationId === input.mutationId) {
    if (previous.dataJson === input.dataJson) return envelope(owner, previous);
    throw new DurableIntakeDraftError('This save identity was already used for different draft data.', 409, envelope(owner, previous));
  }
  const saved = await compareAndSwapIntakeDraft({ ...owner, ...input });
  if (saved) return envelope(owner, saved);
  const current = await findDurableIntakeDraft(owner);
  if (current?.lastMutationId === input.mutationId && current.dataJson === input.dataJson) return envelope(owner, current);
  throw new DurableIntakeDraftError('This draft changed in another tab. Choose which version to keep.', 409, envelope(owner, current));
}
export async function saveDurableIntakeDraft(userId: string, kind: string, key: string, body: unknown) {
  const owner = identity(userId, kind, key);
  const parsed = IntakeDraftWrite.safeParse(body);
  if (!parsed.success) throw new DurableIntakeDraftError('Invalid draft save request.');
  const { data, ...mutation } = parsed.data;
  return mutateDraft(owner, { ...mutation, dataJson: serializeIntakeDraft(data) });
}
export async function clearDurableIntakeDraft(userId: string, kind: string, key: string, body: unknown) {
  const owner = identity(userId, kind, key);
  const parsed = IntakeDraftClear.safeParse(body);
  if (!parsed.success) throw new DurableIntakeDraftError('Invalid draft clear request.');
  return mutateDraft(owner, { ...parsed.data, dataJson: null });
}
