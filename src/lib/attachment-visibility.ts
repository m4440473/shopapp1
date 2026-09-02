type AttachmentLike = {
  kind?: string | null;
  label?: string | null;
};

export type StoredAttachmentScope = 'QUOTE' | 'QUOTE_PART' | 'ORDER' | 'PART';

export const RESTRICTED_ATTACHMENT_LABELS = ['quote', 'po', 'purchase order', 'invoice'];

export function matchesRestrictedAttachmentLabel(label?: string | null) {
  if (!label) return false;
  const normalized = label.trim().toLowerCase();
  return RESTRICTED_ATTACHMENT_LABELS.some((keyword) => normalized.includes(keyword));
}

export function isRestrictedPartAttachment(attachment?: AttachmentLike | null) {
  if (!attachment) return false;
  const kind = typeof attachment.kind === 'string' ? attachment.kind.toUpperCase() : '';
  if (kind === 'PO') return true;
  return matchesRestrictedAttachmentLabel(attachment.label);
}

export function isRestrictedOrderAttachment(attachment?: AttachmentLike | null) {
  if (!attachment) return false;
  return matchesRestrictedAttachmentLabel(attachment.label);
}

export function isDrawingPartAttachment(attachment?: AttachmentLike | null) {
  if (!attachment || isRestrictedPartAttachment(attachment)) return false;
  const kind = typeof attachment.kind === 'string' ? attachment.kind.trim().toUpperCase() : '';
  return ['DWG', 'STEP', 'PDF', 'PRINT', 'IMAGE'].includes(kind);
}

export function canReadStoredAttachment({
  isAdmin,
  scope,
  attachment,
}: {
  isAdmin: boolean;
  scope: StoredAttachmentScope;
  attachment: AttachmentLike;
}) {
  if (isAdmin) return true;
  return scope === 'PART' && isDrawingPartAttachment(attachment);
}
