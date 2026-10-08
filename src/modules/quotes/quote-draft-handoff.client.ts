import { createIntakeDraftTransport } from '@/modules/intake-drafts/durable-intake-draft.client';
import { newIntakeDraftMutationId } from '@/modules/intake-drafts/durable-intake-draft.controller';
import type { IntakeDraftData } from '@/modules/intake-drafts/durable-intake-draft.types';

type PartIdentity = { name: string; partNumber?: string | null; persistedId?: string };
type AttachmentIdentity = { storagePath?: string | null; url?: string | null; persistedId?: string };
export type CreatedQuoteDraftSnapshot = IntakeDraftData & {
  form: { quoteNumber: string };
  parts: PartIdentity[];
  attachments: AttachmentIdentity[];
  currentStep?: number;
  furthestStep?: number;
};
type CreatedQuoteItem = {
  id: string; quoteNumber: string; updatedAt: string; workflowStep?: number;
  parts: Array<PartIdentity & { id: string }>;
  attachments: Array<AttachmentIdentity & { id: string }>;
};
export const QUOTE_HANDOFF_READ_TIMEOUT_MS = 15_000;

async function readCreatedQuote(id: string, fetcher: typeof fetch): Promise<CreatedQuoteItem> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('The quote was created, but its saved details could not be checked. Keep this draft and check the submission again.')); }, QUOTE_HANDOFF_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetcher(`/api/admin/quotes/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal });
      const body = await response.json().catch(() => null);
      const item = body?.item;
      if (!response.ok || item?.id !== id || typeof item.quoteNumber !== 'string' || typeof item.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(item.updatedAt)) || !Array.isArray(item.parts) || !Array.isArray(item.attachments)) {
        throw new Error('The quote was created, but its saved details were not confirmed. Keep this draft and check the submission again.');
      }
      return item as CreatedQuoteItem;
    })(), deadline]);
  } finally { clearTimeout(timer); }
}

/** Save every editor field before releasing the source creation draft. Never overwrites a newer edit draft. */
export async function persistCreatedQuoteDraft<T extends CreatedQuoteDraftSnapshot>(id: string, snapshot: T, pendingKey: string, fetcher: typeof fetch = fetch) {
  const item = await readCreatedQuote(id, fetcher);
  const destination = createIntakeDraftTransport<T>('quote', `edit:${id}`, fetcher);
  const current = await destination.read();
  if (current.state === 'cleared') return { state: 'cleared' as const, item };
  if (current.state === 'saved') {
    if (current.data?.sourceSubmissionKey === pendingKey) return { state: 'existing' as const, item };
    throw new Error('This quote already has a different edit draft. Your original draft is retained; review the existing quote before continuing.');
  }
  const savedParts = [...item.parts];
  const parts = snapshot.parts.map(part => {
    const index = savedParts.findIndex(saved => (part.persistedId && saved.id === part.persistedId)
      || (saved.name === part.name && saved.partNumber === part.partNumber));
    const saved = index >= 0 ? savedParts.splice(index, 1)[0] : null;
    return { ...part, persistedId: saved?.id };
  });
  const savedAttachments = [...item.attachments];
  const attachments = snapshot.attachments.map(attachment => {
    const index = savedAttachments.findIndex(saved => (attachment.persistedId && saved.id === attachment.persistedId)
      || (attachment.storagePath && attachment.storagePath === saved.storagePath)
      || (attachment.url && attachment.url === saved.url));
    const saved = index >= 0 ? savedAttachments.splice(index, 1)[0] : null;
    return { ...attachment, persistedId: saved?.id };
  });
  const step = Number.isInteger(item.workflowStep) ? Math.max(0, Math.min(4, item.workflowStep!)) : snapshot.currentStep ?? 0;
  const data = { ...snapshot, parts, attachments, form: { ...snapshot.form, quoteNumber: item.quoteNumber },
    pendingSubmission: null, baseQuoteUpdatedAt: item.updatedAt, sourceSubmissionKey: pendingKey,
    currentStep: step, furthestStep: Math.max(snapshot.furthestStep ?? 0, step) } as T;
  await destination.write({ expectedRevision: current.revision, mutationId: newIntakeDraftMutationId(), data }, current.ownerId);
  return { state: 'saved' as const, item };
}
