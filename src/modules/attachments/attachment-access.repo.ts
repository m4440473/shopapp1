import 'server-only';

import { prisma } from '@/lib/prisma';
import type { StoredAttachmentScope } from '@/lib/attachment-visibility';

export type StoredAttachment = {
  scope: StoredAttachmentScope;
  mimeType: string | null;
  label: string | null;
  kind: string | null;
};

export async function findStoredAttachmentsByPath(storagePath: string): Promise<StoredAttachment[]> {
  const [quotes, quoteParts, orders, parts] = await Promise.all([
    prisma.quoteAttachment.findMany({
      where: { storagePath },
      select: { mimeType: true, label: true },
    }),
    prisma.quotePartAttachment.findMany({
      where: { storagePath },
      select: { mimeType: true, label: true, kind: true },
    }),
    prisma.attachment.findMany({
      where: { storagePath },
      select: { mimeType: true, label: true },
    }),
    prisma.partAttachment.findMany({
      where: { storagePath },
      select: { mimeType: true, label: true, kind: true },
    }),
  ]);

  return [
    ...quotes.map((attachment) => ({ ...attachment, kind: null, scope: 'QUOTE' as const })),
    ...quoteParts.map((attachment) => ({ ...attachment, scope: 'QUOTE_PART' as const })),
    ...orders.map((attachment) => ({ ...attachment, kind: null, scope: 'ORDER' as const })),
    ...parts.map((attachment) => ({ ...attachment, scope: 'PART' as const })),
  ];
}
