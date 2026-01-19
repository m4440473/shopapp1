import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_QUOTE_METADATA,
  mergeQuoteMetadata,
  parseQuoteMetadata,
  stringifyQuoteMetadata,
  type QuoteApprovalMetadata,
} from '@/lib/quote-metadata';
import { canAccessAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/app-settings';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return { session };
}

const AttachmentSchema = z
  .object({
    url: z.string().trim().max(500).optional(),
    storagePath: z.string().trim().max(500).optional(),
    label: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(200).optional().nullable(),
  })
  .refine((value) => Boolean(value.url?.length || value.storagePath?.length), {
    message: 'Attachment requires a URL or storage path',
    path: ['storagePath'],
  });

const BodySchema = z.object({
  received: z.boolean(),
  attachment: AttachmentSchema.optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { received, attachment } = parsed.data;

  const settings = await getAppSettings();

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: params.id },
      include: { attachments: true },
    });

    if (!quote) {
      return new NextResponse('Not found', { status: 404 });
    }

    const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata) ?? DEFAULT_QUOTE_METADATA);

    if (settings.requirePOForQuoteApproval && received && !attachment && !metadata.approval?.attachmentId) {
      return NextResponse.json(
        { error: 'An approval document must be uploaded before marking as received.' },
        { status: 400 },
      );
    }

    let createdAttachmentId: string | null = null;
    let createdAttachmentLabel: string | null = null;
    let createdAttachmentStoragePath: string | null = null;
    let createdAttachmentUrl: string | null = null;
    let uploadedAt: string | null = null;

    if (received && attachment) {
      const created = await tx.quoteAttachment.create({
        data: {
          quoteId: quote.id,
          url: attachment.url ?? null,
          storagePath: attachment.storagePath ?? null,
          label: attachment.label ?? null,
          mimeType: attachment.mimeType ?? null,
        },
      });
      createdAttachmentId = created.id;
      createdAttachmentLabel = created.label ?? attachment.label ?? null;
      createdAttachmentStoragePath = created.storagePath ?? attachment.storagePath ?? null;
      createdAttachmentUrl = created.url ?? attachment.url ?? null;
      uploadedAt = created.createdAt.toISOString();
    }

    const approval: QuoteApprovalMetadata = {
      ...metadata.approval,
      received,
      attachmentId:
        received && (createdAttachmentId || metadata.approval?.attachmentId)
          ? createdAttachmentId ?? metadata.approval?.attachmentId ?? null
          : null,
      attachmentLabel:
        received && (createdAttachmentLabel || metadata.approval?.attachmentLabel)
          ? createdAttachmentLabel ?? metadata.approval?.attachmentLabel ?? null
          : null,
      attachmentStoragePath:
        received && (createdAttachmentStoragePath || metadata.approval?.attachmentStoragePath)
          ? createdAttachmentStoragePath ?? metadata.approval?.attachmentStoragePath ?? null
          : null,
      attachmentUrl:
        received && (createdAttachmentUrl || metadata.approval?.attachmentUrl)
          ? createdAttachmentUrl ?? metadata.approval?.attachmentUrl ?? null
          : null,
      uploadedAt: received ? uploadedAt ?? metadata.approval?.uploadedAt ?? null : null,
    };

    const updatedMetadata = mergeQuoteMetadata({
      ...metadata,
      approval,
    });

    const updatedQuote = await tx.quote.update({
      where: { id: quote.id },
      data: { metadata: stringifyQuoteMetadata(updatedMetadata) },
      include: { attachments: true },
    });

    return NextResponse.json({
      ok: true,
      approval,
      metadata: mergeQuoteMetadata(parseQuoteMetadata(updatedQuote.metadata) ?? DEFAULT_QUOTE_METADATA),
      attachments: updatedQuote.attachments,
    });
  });
}
