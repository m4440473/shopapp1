import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  DEFAULT_QUOTE_METADATA,
  mergeQuoteMetadata,
  parseQuoteMetadata,
  stringifyQuoteMetadata,
  type QuoteApprovalMetadata,
} from '@/lib/quote-metadata';

export async function listQuotes({
  where,
  take,
  cursor,
}: {
  where?: Record<string, unknown> | null;
  take: number;
  cursor?: string | null;
}) {
  const normalizedWhere = where && Object.keys(where).length ? where : undefined;
  return prisma.quote.findMany({
    where: normalizedWhere,
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: { include: { material: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function findActiveQuoteCustomFields({
  fieldIds,
  business,
}: {
  fieldIds: string[];
  business: string;
}) {
  return prisma.customField.findMany({
    where: {
      id: { in: fieldIds },
      entityType: 'QUOTE',
      isActive: true,
      OR: [{ businessCode: business }, { businessCode: null }],
    },
    select: { id: true },
  });
}

export async function createQuoteWithDetails({
  data,
  prepared,
  normalizedCustomFieldValues,
  userId,
}: {
  data: any;
  prepared: any;
  normalizedCustomFieldValues: { fieldId: string; value: string }[];
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        quoteNumber: prepared.quoteNumber,
        business: data.business,
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        customerId: data.customerId ?? null,
        status: data.status ?? 'DRAFT',
        materialSummary: data.materialSummary ?? null,
        purchaseItems: data.purchaseItems ?? null,
        requirements: data.requirements ?? null,
        notes: data.notes ?? null,
        multiPiece: prepared.multiPiece,
        basePriceCents: prepared.basePriceCents,
        addonsTotalCents: prepared.addonsTotalCents,
        vendorTotalCents: prepared.vendorTotalCents,
        totalCents: prepared.totalCents,
        metadata: stringifyQuoteMetadata({
          ...DEFAULT_QUOTE_METADATA,
          partPricing: data.partPricing?.map((entry: any) => ({
            name: entry.name ?? null,
            partNumber: entry.partNumber ?? null,
            priceCents: entry.priceCents ?? 0,
          })),
        }),
        createdById: userId,
      },
      select: { id: true },
    });

    if (normalizedCustomFieldValues.length) {
      await tx.customFieldValue.createMany({
        data: normalizedCustomFieldValues.map((value) => ({
          fieldId: value.fieldId,
          entityId: quote.id,
          value: value.value,
        })),
      });
    }

    const createdParts = await Promise.all(
      prepared.parts.map((part: any) =>
        tx.quotePart.create({
          data: {
            quoteId: quote.id,
            name: part.name,
            partNumber: part.partNumber,
            materialId: part.materialId,
            stockSize: part.stockSize,
            cutLength: part.cutLength,
            description: part.description,
            quantity: part.quantity,
            pieceCount: part.pieceCount,
            notes: part.notes,
          },
          select: { id: true },
        })
      )
    );

    const addonSelections = prepared.parts.flatMap((part: any, index: number) => {
      const partId = createdParts[index]?.id;
      if (!partId) return [];
      return part.addonSelections.map((selection: any) => ({
        quoteId: quote.id,
        quotePartId: partId,
        addonId: selection.addonId,
        units: selection.units,
        rateTypeSnapshot: selection.rateTypeSnapshot,
        rateCents: selection.rateCents,
        totalCents: selection.totalCents,
        notes: selection.notes,
      }));
    });

    if (addonSelections.length) {
      await tx.quoteAddonSelection.createMany({ data: addonSelections });
    }

    if (prepared.vendorItems.length) {
      await tx.quoteVendorItem.createMany({
        data: prepared.vendorItems.map((item: any) => ({
          quoteId: quote.id,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          partNumber: item.partNumber,
          partUrl: item.partUrl,
          basePriceCents: item.basePriceCents,
          markupPercent: item.markupPercent,
          finalPriceCents: item.finalPriceCents,
          notes: item.notes,
        })),
      });
    }

    if (prepared.attachments.length) {
      await tx.quoteAttachment.createMany({
        data: prepared.attachments.map((attachment: any) => ({
          quoteId: quote.id,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
        })),
      });
    }

    return tx.quote.findUnique({
      where: { id: quote.id },
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        parts: {
          include: {
            material: true,
            addonSelections: {
              include: {
                addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
              },
            },
          },
        },
        vendorItems: true,
        addonSelections: {
          include: {
            addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
          },
        },
        attachments: true,
      },
    });
  });
}

export async function findQuoteById(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: {
        include: {
          material: true,
          addonSelections: {
            include: {
              addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
            },
          },
        },
      },
      vendorItems: true,
      addonSelections: {
        include: {
          addon: { select: { id: true, name: true, rateType: true, rateCents: true } },
        },
      },
      attachments: true,
    },
  });
}

export async function listQuoteCustomFieldValues(entityId: string) {
  return prisma.customFieldValue.findMany({
    where: {
      entityId,
      field: { entityType: 'QUOTE' },
    },
    select: { fieldId: true, value: true },
  });
}

export async function deleteQuoteById(id: string) {
  return prisma.quote.delete({ where: { id } });
}

export async function findQuoteForUpdate(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    select: { quoteNumber: true, metadata: true },
  });
}

export async function updateQuoteWithDetails({
  quoteId,
  data,
  prepared,
  normalizedCustomFieldValues,
  nextMetadata,
}: {
  quoteId: string;
  data: any;
  prepared: any;
  normalizedCustomFieldValues: { fieldId: string; value: string }[];
  nextMetadata: any;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        quoteNumber: prepared.quoteNumber,
        business: data.business,
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        customerId: data.customerId ?? null,
        status: data.status ?? 'DRAFT',
        materialSummary: data.materialSummary ?? null,
        purchaseItems: data.purchaseItems ?? null,
        requirements: data.requirements ?? null,
        notes: data.notes ?? null,
        multiPiece: prepared.multiPiece,
        basePriceCents: prepared.basePriceCents,
        vendorTotalCents: prepared.vendorTotalCents,
        addonsTotalCents: prepared.addonsTotalCents,
        totalCents: prepared.totalCents,
        metadata: stringifyQuoteMetadata(nextMetadata),
      },
    });

    await tx.customFieldValue.deleteMany({ where: { entityId: quoteId } });
    if (normalizedCustomFieldValues.length) {
      await tx.customFieldValue.createMany({
        data: normalizedCustomFieldValues.map((value) => ({
          fieldId: value.fieldId,
          entityId: quoteId,
          value: value.value,
        })),
      });
    }

    await tx.quoteAddonSelection.deleteMany({ where: { quoteId } });
    await tx.quotePart.deleteMany({ where: { quoteId } });
    await tx.quoteVendorItem.deleteMany({ where: { quoteId } });
    await tx.quoteAttachment.deleteMany({ where: { quoteId } });

    const createdParts = await Promise.all(
      prepared.parts.map((part: any) =>
        tx.quotePart.create({
          data: {
            quoteId,
            name: part.name,
            partNumber: part.partNumber,
            materialId: part.materialId,
            stockSize: part.stockSize,
            cutLength: part.cutLength,
            description: part.description,
            quantity: part.quantity,
            pieceCount: part.pieceCount,
            notes: part.notes,
          },
          select: { id: true },
        })
      )
    );

    const addonSelections = prepared.parts.flatMap((part: any, index: number) => {
      const partId = createdParts[index]?.id;
      if (!partId) return [];
      return part.addonSelections.map((selection: any) => ({
        quoteId,
        quotePartId: partId,
        addonId: selection.addonId,
        units: selection.units,
        rateTypeSnapshot: selection.rateTypeSnapshot,
        rateCents: selection.rateCents,
        totalCents: selection.totalCents,
        notes: selection.notes,
      }));
    });

    if (addonSelections.length) {
      await tx.quoteAddonSelection.createMany({ data: addonSelections });
    }

    if (prepared.vendorItems.length) {
      await tx.quoteVendorItem.createMany({
        data: prepared.vendorItems.map((item: any) => ({
          quoteId,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          partNumber: item.partNumber,
          partUrl: item.partUrl,
          basePriceCents: item.basePriceCents,
          markupPercent: item.markupPercent,
          finalPriceCents: item.finalPriceCents,
          notes: item.notes,
        })),
      });
    }

    if (prepared.attachments.length) {
      await tx.quoteAttachment.createMany({
        data: prepared.attachments.map((attachment: any) => ({
          quoteId,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
        })),
      });
    }

    return tx.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        parts: {
          include: {
            material: true,
            addonSelections: {
              include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
            },
          },
        },
        vendorItems: true,
        addonSelections: {
          include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
        },
        attachments: true,
      },
    });
  });
}

export async function updateQuoteApproval({
  quoteId,
  received,
  attachment,
  requireAttachment,
}: {
  quoteId: string;
  received: boolean;
  attachment?: { url?: string; storagePath?: string; label?: string; mimeType?: string | null };
  requireAttachment: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { attachments: true },
    });

    if (!quote) {
      return { status: 404, error: 'Not found' };
    }

    const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata) ?? DEFAULT_QUOTE_METADATA);

    if (requireAttachment && received && !attachment && !metadata.approval?.attachmentId) {
      return { status: 400, error: 'An approval document must be uploaded before marking as received.' };
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

    return {
      status: 200,
      approval,
      metadata: mergeQuoteMetadata(parseQuoteMetadata(updatedQuote.metadata) ?? DEFAULT_QUOTE_METADATA),
      attachments: updatedQuote.attachments,
    };
  });
}

export async function findQuoteForConversion(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      parts: {
        include: {
          material: true,
          addonSelections: {
            include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true, departmentId: true } } },
          },
        },
      },
      addonSelections: {
        include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true, departmentId: true } } },
      },
      attachments: true,
    },
  });
}

export async function findActiveOrderCustomFields({
  fieldIds,
  business,
}: {
  fieldIds: string[];
  business: string;
}) {
  return prisma.customField.findMany({
    where: {
      id: { in: fieldIds },
      entityType: 'ORDER',
      isActive: true,
      OR: [{ businessCode: business }, { businessCode: null }],
    },
    select: { id: true },
  });
}

export async function convertQuoteToOrder({
  quote,
  metadata,
  orderNumber,
  now,
  dueDate,
  priority,
  modelIncluded,
  materialNeeded,
  materialOrdered,
  vendorId,
  poNumber,
  assignedMachinistId,
  partsData,
  orderAttachments,
  noteContent,
  userId,
  normalizedCustomFieldValues,
}: {
  quote: any;
  metadata: any;
  orderNumber: string;
  now: Date;
  dueDate: Date;
  priority: string;
  modelIncluded: boolean;
  materialNeeded: boolean;
  materialOrdered: boolean;
  vendorId: string | null;
  poNumber: string | null;
  assignedMachinistId: string | null;
  partsData: Array<{
    partNumber: string | null;
    quantity: number;
    materialId: string | null;
    stockSize?: string | null;
    cutLength?: string | null;
    notes?: string | null;
  }>;
  orderAttachments: Array<{
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
  }>;
  noteContent: string | null;
  userId?: string;
  normalizedCustomFieldValues: { fieldId: string; value: string }[];
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        business: quote.business,
        customerId: quote.customerId,
        modelIncluded,
        receivedDate: now,
        dueDate,
        priority,
        status: 'RECEIVED',
        materialNeeded,
        materialOrdered,
        vendorId,
        poNumber,
        assignedMachinistId,
      },
      select: { id: true },
    });

    if (normalizedCustomFieldValues.length) {
      await tx.customFieldValue.createMany({
        data: normalizedCustomFieldValues.map((value) => ({
          fieldId: value.fieldId,
          entityId: order.id,
          value: value.value,
        })),
      });
    }

    const orderParts = await Promise.all(
      partsData.map((part) =>
        tx.orderPart.create({
          data: {
            orderId: order.id,
            partNumber: part.partNumber,
            quantity: part.quantity,
            materialId: part.materialId,
            stockSize: part.stockSize ?? null,
            cutLength: part.cutLength ?? null,
            notes: part.notes ?? undefined,
          },
          select: { id: true },
        })
      )
    );

    if (orderAttachments.length) {
      await tx.attachment.createMany({
        data: orderAttachments.map((attachment) => ({
          orderId: order.id,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
          uploadedById: userId ?? null,
        })),
      });
    }

    if (noteContent && userId) {
      await tx.note.create({
        data: {
          orderId: order.id,
          content: noteContent,
          userId,
        },
      });
    }

    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        from: 'RECEIVED',
        to: 'RECEIVED',
        userId,
        reason: `Converted from quote ${quote.quoteNumber}`,
      },
    });

    const quotePartSelections = quote.parts.flatMap((part: any, index: number) => {
      const orderPartId = orderParts[index]?.id;
      if (!orderPartId) return [];
      return (part.addonSelections ?? []).map((selection: any) => ({
        selection,
        orderPartId,
      }));
    });

    const legacySelections =
      quote.addonSelections
        ?.filter((selection: any) => !selection.quotePartId)
        .map((selection: any) => ({
          selection,
          orderPartId: orderParts[0]?.id ?? null,
        })) ?? [];

    const chargeSelections = [...quotePartSelections, ...legacySelections].filter(
      (entry: any) => entry.orderPartId && entry.selection.addon?.departmentId
    );

    if (chargeSelections.length) {
      await Promise.all(
        chargeSelections.map(({ selection, orderPartId }: any, index: number) =>
          tx.orderCharge.create({
            data: {
              orderId: order.id,
              partId: orderPartId!,
              departmentId: selection.addon?.departmentId ?? '',
              addonId: selection.addonId,
              kind: 'ADDON',
              name: selection.addon?.name ?? 'Add-on',
              description: selection.notes ?? null,
              quantity: new Prisma.Decimal(selection.units ?? 0),
              unitPrice: new Prisma.Decimal(selection.rateCents ?? 0),
              sortOrder: index,
            },
          })
        )
      );
    }

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
}
