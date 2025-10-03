import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_QUOTE_METADATA,
  mergeQuoteMetadata,
  parseQuoteMetadata,
  stringifyQuoteMetadata,
} from '@/lib/quote-metadata';
import { generateNextOrderNumber } from '@/lib/orders.server';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/rbac';
import { businessNameFromCode, type BusinessCode, type BusinessName } from '@/lib/businesses';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';

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

interface PreparedAttachment {
  url: string | null;
  storagePath: string | null;
  label: string | null;
  mimeType: string | null;
}

function buildPartNotes(part: { description: string | null; notes: string | null; pieceCount: number }): string | null {
  const lines: string[] = [];
  if (part.description) {
    lines.push(part.description.trim());
  }
  if (part.pieceCount > 1) {
    lines.push(`Pieces: ${part.pieceCount}`);
  }
  if (part.notes) {
    lines.push(part.notes.trim());
  }
  const combined = lines.join('\n').trim();
  return combined.length ? combined : null;
}

function buildConversionNote(quote: any, now: Date): string | null {
  const sections: string[] = [`Converted from quote ${quote.quoteNumber} on ${now.toLocaleString()}.`];
  if (quote.materialSummary) {
    sections.push(`Materials:\n${quote.materialSummary}`);
  }
  if (quote.purchaseItems) {
    sections.push(`Purchase items:\n${quote.purchaseItems}`);
  }
  if (quote.requirements) {
    sections.push(`Requirements:\n${quote.requirements}`);
  }
  if (quote.notes) {
    sections.push(`Quote notes:\n${quote.notes}`);
  }

  const content = sections.join('\n\n').trim();
  return content.length ? content : null;
}

async function prepareAttachments({
  attachments,
  businessName,
  customerName,
  orderNumber,
}: {
  attachments: Array<{ storagePath: string | null; url: string | null; label: string | null; mimeType: string | null }>;
  businessName: BusinessName;
  customerName: string;
  orderNumber: string;
}): Promise<PreparedAttachment[]> {
  if (!attachments.length) return [];

  const prepared: PreparedAttachment[] = [];
  const attachmentRoot = await ensureAttachmentRoot();

  for (const attachment of attachments) {
    if (attachment.storagePath) {
      const sourcePath = path.join(attachmentRoot, attachment.storagePath);
      let buffer: Buffer;
      try {
        buffer = await readFile(sourcePath);
      } catch (error) {
        throw new Error(`Unable to read attachment ${attachment.storagePath}`);
      }

      const stored = await storeAttachmentFile({
        business: businessName,
        customerName,
        referenceNumber: orderNumber,
        originalFilename: attachment.label || path.basename(sourcePath),
        buffer,
      });

      prepared.push({
        url: null,
        storagePath: stored.storagePath,
        label: attachment.label ?? path.basename(stored.storagePath),
        mimeType: attachment.mimeType ?? null,
      });
      continue;
    }

    if (attachment.url) {
      prepared.push({
        url: attachment.url,
        storagePath: null,
        label: attachment.label ?? null,
        mimeType: attachment.mimeType ?? null,
      });
    }
  }

  return prepared;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      parts: true,
      addonSelections: true,
      attachments: true,
    },
  });

  if (!quote) {
    return new NextResponse('Not found', { status: 404 });
  }

  const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata) ?? DEFAULT_QUOTE_METADATA);

  if (metadata.conversion?.orderId) {
    return NextResponse.json(
      { error: `Quote already converted to order ${metadata.conversion.orderNumber}` },
      { status: 409 },
    );
  }

  if (!metadata.approval?.received) {
    return NextResponse.json({ error: 'Approval must be received before conversion.' }, { status: 400 });
  }

  if (!quote.customerId) {
    return NextResponse.json({ error: 'Assign a customer before converting this quote.' }, { status: 400 });
  }

  const businessCode = quote.business as BusinessCode;
  const businessName = businessNameFromCode(quote.business) as BusinessName;
  const customerName = (quote.customer?.name || quote.companyName || 'Customer').trim();

  if (!customerName) {
    return NextResponse.json({ error: 'Customer information is required before conversion.' }, { status: 400 });
  }

  const orderNumber = await generateNextOrderNumber(businessCode);

  let orderAttachments: PreparedAttachment[] = [];
  try {
    orderAttachments = await prepareAttachments({
      attachments: quote.attachments,
      businessName,
      customerName,
      orderNumber,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to copy attachments';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const partsData = quote.parts.map((part) => ({
    partNumber: part.name,
    quantity: part.quantity ?? 1,
    materialId: null,
    notes: buildPartNotes({
      description: part.description ?? null,
      notes: part.notes ?? null,
      pieceCount: part.pieceCount ?? 1,
    }),
  }));

  const addonIds = Array.from(new Set(quote.addonSelections.map((selection) => selection.addonId))).filter(Boolean);

  const now = new Date();
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const noteContent = buildConversionNote(quote, now);
  const userId = (guard.session.user as any)?.id as string | undefined;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        business: quote.business,
        customerId: quote.customerId,
        modelIncluded: quote.multiPiece,
        receivedDate: now,
        dueDate,
        priority: 'NORMAL',
        status: 'RECEIVED',
        materialNeeded: false,
        materialOrdered: false,
        vendorId: null,
        poNumber: null,
        assignedMachinistId: null,
        parts: partsData.length
          ? {
              create: partsData.map((part) => ({
                partNumber: part.partNumber,
                quantity: part.quantity,
                materialId: part.materialId,
                notes: part.notes ?? undefined,
              })),
            }
          : undefined,
        checklist: addonIds.length
          ? {
              create: addonIds.map((addonId) => ({ addonId })),
            }
          : undefined,
        attachments: orderAttachments.length
          ? {
              create: orderAttachments.map((attachment) => ({
                url: attachment.url,
                storagePath: attachment.storagePath,
                label: attachment.label,
                mimeType: attachment.mimeType,
                uploadedById: userId ?? null,
              })),
            }
          : undefined,
        notes:
          noteContent && userId
            ? {
                create: {
                  content: noteContent,
                  userId,
                },
              }
            : undefined,
        statusHistory: {
          create: {
            from: 'RECEIVED',
            to: 'RECEIVED',
            userId,
            reason: `Converted from quote ${quote.quoteNumber}`,
          },
        },
      },
      select: { id: true },
    });

    const updatedMetadata = mergeQuoteMetadata({
      ...metadata,
      conversion: {
        orderId: order.id,
        orderNumber,
        convertedAt: now.toISOString(),
      },
      approval: metadata.approval,
    });

    await tx.quote.update({
      where: { id: quote.id },
      data: {
        metadata: stringifyQuoteMetadata(updatedMetadata),
      },
    });

    return { orderId: order.id, metadata: updatedMetadata };
  });

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    orderNumber,
    metadata: result.metadata,
  });
}
