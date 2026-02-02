type AttachmentLike = {
  kind?: string | null;
  label?: string | null;
};

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
