import 'server-only';

import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { z } from 'zod';

import {
  DEFAULT_QUOTE_METADATA,
  mergeQuoteMetadata,
  parseQuoteMetadata,
} from '@/lib/quote-metadata';
import { generateNextOrderNumber } from '@/modules/orders/orders.service';
import { canAccessAdmin } from '@/lib/rbac';
import { businessNameFromCode, type BusinessCode, type BusinessName } from '@/lib/businesses';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';
import { OrderPartCreate, PriorityEnum } from '@/modules/orders/orders.schema';
import { getAppSettings } from '@/lib/app-settings';
import { syncChecklistForOrder } from '@/modules/orders/orders.service';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import { convertQuoteToOrder, findActiveOrderCustomFields, findQuoteForConversion } from '@/modules/quotes/quotes.service';

async function requireAdmin() {
  const session = await getServerAuthSession();
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

const ConversionOverrides = z.object({
  dueDate: z.string().trim().optional(),
  priority: PriorityEnum.optional(),
  vendorId: z.string().trim().optional(),
  poNumber: z.string().trim().optional(),
  assignedMachinistId: z.string().trim().optional(),
  materialNeeded: z.boolean().optional(),
  materialOrdered: z.boolean().optional(),
  modelIncluded: z.boolean().optional(),
  parts: z.array(OrderPartCreate).optional(),
  notes: z.string().trim().max(1000).optional(),
  customFieldValues: z
    .array(
      z.object({
        fieldId: z.string().trim().min(1),
        value: z.unknown().optional(),
      })
    )
    .optional(),
});

function buildPartNotes(part: {
  description: string | null;
  notes: string | null;
  pieceCount: number;
  stockSize?: string | null;
  cutLength?: string | null;
}): string | null {
  const lines: string[] = [];
  if (part.description) {
    lines.push(part.description.trim());
  }
  if (part.pieceCount > 1) {
    lines.push(`Pieces: ${part.pieceCount}`);
  }
  if (part.stockSize) {
    lines.push(`Stock size: ${part.stockSize}`);
  }
  if (part.cutLength) {
    lines.push(`Cut length: ${part.cutLength}`);
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
  rootDir,
}: {
  attachments: Array<{ storagePath: string | null; url: string | null; label: string | null; mimeType: string | null }>;
  businessName: BusinessName;
  customerName: string;
  orderNumber: string;
  rootDir: string;
}): Promise<PreparedAttachment[]> {
  if (!attachments.length) return [];

  const prepared: PreparedAttachment[] = [];
  const attachmentRoot = await ensureAttachmentRoot(rootDir);

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
        rootDir,
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

  const settings = await getAppSettings();

  let overrides: z.infer<typeof ConversionOverrides> | null = null;
  if (req.headers.get('content-type')?.includes('application/json')) {
    const json = await req.json().catch(() => null);
    if (json && Object.keys(json).length > 0) {
      const parsed = ConversionOverrides.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      overrides = parsed.data;
    }
  }

  const quote = await findQuoteForConversion(params.id);

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

  if (settings.requirePOForQuoteToOrder) {
    const hasApprovalAttachment = Boolean(
      metadata.approval?.attachmentId ||
        metadata.approval?.attachmentUrl ||
        metadata.approval?.attachmentStoragePath,
    );
    if (!hasApprovalAttachment) {
      return NextResponse.json(
        { error: 'Attach the approval or PO before converting this quote.' },
        { status: 400 },
      );
    }
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

  const now = new Date();
  const dueDate = overrides?.dueDate ? new Date(overrides.dueDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Provide a valid due date for the order.' }, { status: 400 });
  }

  let orderAttachments: PreparedAttachment[] = [];
  try {
    orderAttachments = await prepareAttachments({
      attachments: quote.attachments,
      businessName,
      customerName,
      orderNumber,
      rootDir: settings.attachmentsDir,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to copy attachments';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const partsData = (overrides?.parts ??
    quote.parts.map((part) => ({
      partNumber: part.partNumber ?? part.name,
      quantity: part.quantity ?? 1,
      materialId: part.materialId ?? null,
      stockSize: part.stockSize ?? null,
      cutLength: part.cutLength ?? null,
      notes: buildPartNotes({
        description: part.description ?? null,
        notes: part.notes ?? null,
        pieceCount: part.pieceCount ?? 1,
        stockSize: part.stockSize ?? null,
        cutLength: part.cutLength ?? null,
      }),
    }))).map((part) => ({
    ...part,
    materialId: part.materialId ?? null,
    stockSize: part.stockSize ?? null,
    cutLength: part.cutLength ?? null,
    notes: part.notes ?? null,
  }));

  if (partsData.length === 0) {
    return NextResponse.json({ error: 'Add at least one part before converting.' }, { status: 400 });
  }

  const noteContent = overrides?.notes ?? buildConversionNote(quote, now);
  const userId = (guard.session.user as any)?.id as string | undefined;

  const priority = overrides?.priority ?? 'NORMAL';
  const modelIncluded = overrides?.modelIncluded ?? quote.multiPiece;
  const materialNeeded = overrides?.materialNeeded ?? false;
  const materialOrdered = overrides?.materialOrdered ?? false;
  const customFieldValues = overrides?.customFieldValues ?? [];
  const validCustomFieldValues = customFieldValues.length
    ? await findActiveOrderCustomFields({
        fieldIds: customFieldValues.map((value) => value.fieldId),
        business: businessCode,
      })
    : [];
  const allowedFieldIds = new Set(validCustomFieldValues.map((field) => field.id));
  const normalizedCustomFieldValues = customFieldValues
    .filter((value) => allowedFieldIds.has(value.fieldId) && hasCustomFieldValue(value.value))
    .map((value) => ({
      fieldId: value.fieldId,
      value: serializeCustomFieldValue(value.value),
    }))
    .filter((value) => value.value !== null);

  const result = await convertQuoteToOrder({
    quote,
    metadata,
    orderNumber,
    now,
    dueDate,
    priority,
    modelIncluded,
    materialNeeded,
    materialOrdered,
    vendorId: overrides?.vendorId ?? null,
    poNumber: overrides?.poNumber ?? null,
    assignedMachinistId: overrides?.assignedMachinistId ?? null,
    partsData,
    orderAttachments,
    noteContent,
    userId,
    normalizedCustomFieldValues,
  });

  await syncChecklistForOrder(result.orderId);

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    orderNumber,
    metadata: result.metadata,
  });
}
