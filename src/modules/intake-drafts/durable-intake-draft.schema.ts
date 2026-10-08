import { z } from 'zod';
import { DurableIntakeDraftError, INTAKE_DRAFT_MAX_BYTES, type IntakeDraftData } from './durable-intake-draft.types';

export const IntakeDraftIdentity = z.object({
  kind: z.enum(['order', 'quote']),
  key: z.string().max(180).regex(/^(new|(?:edit|repeat|convert):[A-Za-z0-9_-]{1,150})$/),
});
const mutation = {
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  mutationId: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
};
export const IntakeDraftWrite = z.object({ ...mutation, data: z.record(z.string(), z.unknown()), reactivate: z.boolean().optional() }).strict();
export const IntakeDraftClear = z.object(mutation).strict();

/** Drafts retain incomplete form data; validate the bounded JSON envelope, not final-order rules. */
export function serializeIntakeDraft(data: IntakeDraftData) {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: data, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > 100_000 || depth > 40) throw new DurableIntakeDraftError('This draft is too complex to save.', 413);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new DurableIntakeDraftError('Draft numbers must be finite.');
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) pending.push({ value: item, depth: depth + 1 });
    } else if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new DurableIntakeDraftError('Draft data must contain JSON values.');
    }
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, 'utf8') > INTAKE_DRAFT_MAX_BYTES) throw new DurableIntakeDraftError('This draft is too large to save.', 413);
  return serialized;
}
