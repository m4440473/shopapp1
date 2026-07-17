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
import { canAccessAdmin } from '@/lib/rbac';
import { businessNameFromCode, type BusinessCode, type BusinessName } from '@/lib/businesses';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';
import { PriorityEnum } from '@/modules/orders/orders.schema';
import { getAppSettings } from '@/lib/app-settings';
import {
  ensureOrderFilesInCanonicalStorage,
  initializeCurrentDepartmentForOrder,
  syncChecklistForOrder,
} from '@/modules/orders/orders.service';
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
  poNumber: z.string().trim().optional(),
  assignedMachinistId: z.string().trim().optional(),
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

function optionalId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

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

function buildConversionWorkInstructions(quote: any, part: any): string | null {
  const toBulletLines = (value: unknown) =>
    String(value ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`);

  const buildSection = (heading: string, value: unknown) => {
    const items = toBulletLines(value);
    if (!items.length) return '';
    return `${heading}:\n${items.join('\n')}`;
  };

  const sections = [
    buildSection('Quote requirements', quote?.requirements),
    buildSection('Quote notes', quote?.notes),
    buildSection('Materials', quote?.materialSummary),
    buildSection('Purchase items', quote?.purchaseItems),
    buildSection('Part description', part?.description),
    buildSection('Part-specific notes', part?.notes),
  ].filter(Boolean);

  const content = sections.join('\n\n').trim();
  return content.length ? content : null;
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const quote = await findQuoteForConversion(id);

  if (!quote) {
    return new NextResponse('Not found', { status: 404 });
  }

  const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata) ?? DEFAULT_QUOTE_METADATA);

  if (metadata.conversion?.orderId) {
    const convertedLabel = metadata.conversion.orderNumber ?? metadata.conversion.orderId;
    return NextResponse.json(
      { error: `Quote already converted to order ${convertedLabel}` },
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

  const now = new Date();
  const dueDate = overrides?.dueDate ? new Date(overrides.dueDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Provide a valid due date for the order.' }, { status: 400 });
  }

  let orderAttachments: PreparedAttachment[] = [];
  let preparedPartAttachments: Array<PreparedAttachment & { sourceQuotePartId: string; kind: string }> = [];
  try {
    orderAttachments = await prepareAttachments({
      attachments: quote.attachments,
      businessName,
      customerName,
      orderNumber: quote.quoteNumber,
      rootDir: settings.attachmentsDir,
    });
    for (const quotePart of quote.parts) {
      for (const attachment of quotePart.attachments ?? []) {
        const [prepared] = await prepareAttachments({
          attachments: [attachment],
          businessName,
          customerName,
          orderNumber: quote.quoteNumber,
          rootDir: settings.attachmentsDir,
        });
        if (prepared) {
          preparedPartAttachments.push({
            ...prepared,
            sourceQuotePartId: quotePart.id,
            kind: attachment.kind || 'DWG',
          });
        }
      }
    }
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to copy attachments';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const partsData = quote.parts.map((part) => ({
      partNumber: part.partNumber ?? part.name,
      partName: part.name ?? null,
      quantity: part.quantity ?? 1,
      materialId: optionalId(part.materialId),
      stockSize: part.stockSize ?? null,
      cutLength: part.cutLength ?? null,
      notes: buildPartNotes({
        description: part.description ?? null,
        notes: part.notes ?? null,
        pieceCount: part.pieceCount ?? 1,
        stockSize: part.stockSize ?? null,
        cutLength: part.cutLength ?? null,
      }),
      workInstructions: buildConversionWorkInstructions(quote, part),
  })).map((part, index) => {
    const quotePart = quote.parts[index];
    return ({
    ...part,
    sourceQuotePartId: quotePart?.id ?? null,
    partName: part.partName?.trim() ? part.partName.trim() : null,
    materialId: optionalId(part.materialId),
    drawingMaterialText: quotePart?.drawingMaterialText ?? null,
    drawingFinishText: quotePart?.drawingFinishText ?? null,
    finish: quotePart?.finish ?? null,
    materialStatus: quotePart?.materialStatus ?? 'UNREVIEWED',
    inventoryLocation: quotePart?.inventoryLocation ?? null,
    materialNotes: quotePart?.materialNotes ?? null,
    procurementVendorId: optionalId(quotePart?.procurementVendorId),
    stockSize: part.stockSize ?? null,
    cutLength: part.cutLength ?? null,
    notes: part.notes ?? null,
    workInstructions: part.workInstructions?.trim() ? part.workInstructions.trim() : null,
  });
  });

  if (partsData.length === 0) {
    return NextResponse.json({ error: 'Add at least one part before converting.' }, { status: 400 });
  }

  const noteContent = overrides?.notes ?? buildConversionNote(quote, now);
  const userId = (guard.session.user as any)?.id as string | undefined;

  const priority = overrides?.priority ?? 'NORMAL';
  const modelIncluded = quote.parts.some((part) =>
    (part.attachments ?? []).some((attachment) => {
      const label = (attachment.label ?? attachment.storagePath ?? attachment.url ?? '').toLowerCase();
      return attachment.kind === 'STEP' || label.endsWith('.step') || label.endsWith('.stp');
    }),
  );
  const materialNeeded = quote.parts.some((part) => part.materialStatus === 'NEED_TO_ORDER');
  const materialOrdered = false;
  const procurementVendorIds: string[] = Array.from(
    new Set<string>(
      quote.parts
        .filter((part) => part.materialStatus === 'NEED_TO_ORDER')
        .map((part) => optionalId(part.procurementVendorId))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const vendorId = procurementVendorIds.length === 1 ? procurementVendorIds[0] : null;
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

  try {
    const result = await convertQuoteToOrder({
      quote,
      metadata,
      now,
      dueDate,
      priority,
      modelIncluded,
      materialNeeded,
      materialOrdered,
      vendorId,
      poNumber: overrides?.poNumber ?? null,
      assignedMachinistId: overrides?.assignedMachinistId ?? null,
      partsData,
      orderAttachments,
      partAttachments: preparedPartAttachments,
      noteContent,
      userId,
      normalizedCustomFieldValues,
    });

    await syncChecklistForOrder(result.orderId);
    await initializeCurrentDepartmentForOrder(result.orderId);
    await ensureOrderFilesInCanonicalStorage(result.orderId);

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      metadata: result.metadata,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : String(error?.meta?.target ?? '');
      if (target.includes('sourceQuoteId')) {
        return NextResponse.json({ error: 'This quote has already been converted to an order.' }, { status: 409 });
      }
      return NextResponse.json(
        {
          error:
            'Conversion failed because duplicate checklist items were generated for the same part/add-on. Please retry, and contact support if this persists.',
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to convert quote to order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
