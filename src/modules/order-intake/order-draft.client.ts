import type { CreationSubmissionScope } from '@/modules/submissions/submissions.types';

export function orderDraftTarget(templateId: string | null, quoteId: string | null) {
  if (templateId) return { key: `repeat:${templateId}`, scope: `order:repeat:${templateId}` as CreationSubmissionScope, url: `/api/repeat-order-templates/${encodeURIComponent(templateId)}/create-order` };
  if (quoteId) return { key: `convert:${quoteId}`, scope: `quote:convert:${quoteId}` as CreationSubmissionScope, url: `/api/admin/quotes/${encodeURIComponent(quoteId)}/convert` };
  return { key: 'new', scope: 'order:create' as CreationSubmissionScope, url: '/api/orders' };
}

export function mergeImportedOrderParts<T extends { key: string; drawingImportPageId?: string }>(existing: T[], incoming: T[]) {
  const seen = new Set(existing.map((part) => part.drawingImportPageId || part.key));
  return [...existing, ...incoming.filter((part) => {
    const key = part.drawingImportPageId || part.key;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  })];
}

/** Discard only the initial untouched row, never a partly entered part. */
export function orderPartHasInput<T extends { quantity: string }>(part: T) {
  if (part.quantity !== '1') return true;
  return Object.entries(part as Record<string, unknown>).some(([field, value]) => {
    if (field === 'key' || field === 'quantity' || value === undefined || value === null) return false;
    if (typeof value === 'string') return Boolean(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
}

export function mergeOrderDraftFiles<T extends { storagePath: string; url: string }>(existing: T[], incoming: T[]) {
  const files = new Map<string, T>();
  for (const file of [...existing, ...incoming]) {
    const key = file.storagePath.trim() || file.url.trim();
    if (key && !files.has(key)) files.set(key, file);
  }
  return [...files.values()];
}

export function orderPartReadiness(parts: Array<{ key: string; partNumber: string; partName: string; quantity: string }>) {
  if (!parts.length) return { message: 'Add at least one part with a part number.', partKey: null };
  for (const [index, part] of parts.entries()) {
    if (!part.partNumber.trim()) return { message: `Part ${index + 1} needs a part number.`, partKey: part.key };
    const quantity = Number(part.quantity);
    if (!part.quantity.trim() || !Number.isSafeInteger(quantity) || quantity < 1) return { message: `${part.partNumber}: quantity must be a positive whole number.`, partKey: part.key };
  }
  return null;
}
