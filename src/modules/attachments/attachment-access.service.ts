import 'server-only';

import { canReadStoredAttachment } from '@/lib/attachment-visibility';
import { findStoredAttachmentsByPath } from './attachment-access.repo';

export async function resolveStoredAttachmentAccess(storagePath: string, isAdmin: boolean) {
  const attachments = await findStoredAttachmentsByPath(storagePath);
  if (!attachments.length) return { ok: false as const, status: 404, error: 'Not found' };

  const attachment = attachments.find((candidate) => (
    canReadStoredAttachment({ isAdmin, scope: candidate.scope, attachment: candidate })
  ));
  return attachment
    ? { ok: true as const, attachment }
    : { ok: false as const, status: 403, error: 'Forbidden' };
}
