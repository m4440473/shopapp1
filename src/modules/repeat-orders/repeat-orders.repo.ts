import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function findOrderTemplateSource(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      parts: {
        orderBy: [{ createdAt: 'asc' }, { partNumber: 'asc' }],
        include: {
          charges: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              departmentId: true,
              addonId: true,
              kind: true,
              name: true,
              description: true,
              quantity: true,
              unitPrice: true,
              sortOrder: true,
            },
          },
          attachments: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              kind: true,
              url: true,
              storagePath: true,
              label: true,
              mimeType: true,
            },
          },
        },
      },
      attachments: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          url: true,
          storagePath: true,
          label: true,
          mimeType: true,
        },
      },
    },
  });
}

export async function createRepeatOrderTemplate(data: {
  customerId: string;
  sourceOrderId: string;
  name: string;
  business: string;
  vendorId: string | null;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
  priority: string;
  notes: string | null;
  createdById?: string | null;
  parts: Array<{
    partNumber: string;
    quantity: number;
    materialId: string | null;
    stockSize: string | null;
    cutLength: string | null;
    notes: string | null;
    workInstructions: string | null;
    instructionsVersion: number;
    sortOrder: number;
    charges: Array<{
      departmentId: string;
      addonId: string | null;
      kind: string;
      name: string;
      description: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      sortOrder: number;
    }>;
    attachments: Array<{
      kind: string;
      url: string | null;
      storagePath: string | null;
      label: string | null;
      mimeType: string | null;
      sortOrder: number;
    }>;
  }>;
  attachments: Array<{
    kind: string;
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
    sortOrder: number;
  }>;
}) {
  return prisma.repeatOrderTemplate.create({
    data: {
      customerId: data.customerId,
      sourceOrderId: data.sourceOrderId,
      name: data.name,
      business: data.business,
      vendorId: data.vendorId,
      materialNeeded: data.materialNeeded,
      materialOrdered: data.materialOrdered,
      modelIncluded: data.modelIncluded,
      priority: data.priority,
      notes: data.notes,
      createdById: data.createdById ?? null,
      parts: {
        create: data.parts.map((part) => ({
          partNumber: part.partNumber,
          quantity: part.quantity,
          materialId: part.materialId,
          stockSize: part.stockSize,
          cutLength: part.cutLength,
          notes: part.notes,
          workInstructions: part.workInstructions,
          instructionsVersion: part.instructionsVersion,
          sortOrder: part.sortOrder,
          charges: {
            create: part.charges.map((charge) => ({
              departmentId: charge.departmentId,
              addonId: charge.addonId,
              kind: charge.kind,
              name: charge.name,
              description: charge.description,
              quantity: charge.quantity,
              unitPrice: charge.unitPrice,
              sortOrder: charge.sortOrder,
            })),
          },
          attachments: {
            create: part.attachments.map((attachment) => ({
              kind: attachment.kind,
              url: attachment.url,
              storagePath: attachment.storagePath,
              label: attachment.label,
              mimeType: attachment.mimeType,
              sortOrder: attachment.sortOrder,
            })),
          },
        })),
      },
      attachments: {
        create: data.attachments.map((attachment) => ({
          kind: attachment.kind,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
          sortOrder: attachment.sortOrder,
        })),
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
      sourceOrder: { select: { id: true, orderNumber: true } },
      parts: { select: { id: true } },
    },
  });
}

export async function listRepeatOrderTemplates(params: { customerId?: string; take: number }) {
  return prisma.repeatOrderTemplate.findMany({
    where: params.customerId ? { customerId: params.customerId } : undefined,
    take: params.take,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      customer: { select: { id: true, name: true } },
      sourceOrder: { select: { id: true, orderNumber: true } },
      parts: { select: { id: true } },
    },
  });
}

export async function findRepeatOrderTemplateById(templateId: string) {
  return prisma.repeatOrderTemplate.findUnique({
    where: { id: templateId },
    include: {
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      sourceOrder: { select: { id: true, orderNumber: true } },
      attachments: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      parts: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          charges: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          attachments: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });
}

export async function createOrderFromRepeatTemplate(data: {
  orderNumber: string;
  business: string;
  customerId: string;
  receivedDate: Date;
  dueDate: Date;
  priority: string;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
  vendorId: string | null;
  poNumber: string | null;
  assignedMachinistId: string | null;
  notes: string | null;
  userId?: string | null;
  parts: Array<{
    templatePartId: string;
    partNumber: string;
    quantity: number;
    materialId: string | null;
    stockSize: string | null;
    cutLength: string | null;
    notes: string | null;
    workInstructions: string | null;
    instructionsVersion: number;
    charges: Array<{
      departmentId: string;
      addonId: string | null;
      kind: string;
      name: string;
      description: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      sortOrder: number;
    }>;
    attachments: Array<{
      kind: string;
      url: string | null;
      storagePath: string | null;
      label: string | null;
      mimeType: string | null;
    }>;
  }>;
  attachments: Array<{
    kind: string;
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: data.orderNumber,
        business: data.business,
        customerId: data.customerId,
        status: 'RECEIVED',
        priority: data.priority,
        dueDate: data.dueDate,
        receivedDate: data.receivedDate,
        modelIncluded: data.modelIncluded,
        materialNeeded: data.materialNeeded,
        materialOrdered: data.materialOrdered,
        vendorId: data.vendorId,
        poNumber: data.poNumber,
        assignedMachinistId: data.assignedMachinistId,
      },
      select: { id: true },
    });

    const createdParts = new Map<string, string>();
    for (const part of data.parts) {
      const createdPart = await tx.orderPart.create({
        data: {
          orderId: order.id,
          partNumber: part.partNumber,
          quantity: part.quantity,
          materialId: part.materialId,
          stockSize: part.stockSize,
          cutLength: part.cutLength,
          notes: part.notes,
          workInstructions: part.workInstructions,
          instructionsVersion: part.instructionsVersion,
        },
        select: { id: true },
      });
      createdParts.set(part.templatePartId, createdPart.id);

      if (part.charges.length) {
        await tx.orderCharge.createMany({
          data: part.charges.map((charge) => ({
            orderId: order.id,
            partId: createdPart.id,
            departmentId: charge.departmentId,
            addonId: charge.addonId,
            kind: charge.kind,
            name: charge.name,
            description: charge.description,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            sortOrder: charge.sortOrder,
          })),
        });
      }

      if (part.attachments.length) {
        await tx.partAttachment.createMany({
          data: part.attachments.map((attachment) => ({
            orderId: order.id,
            partId: createdPart.id,
            kind: attachment.kind,
            url: attachment.url,
            storagePath: attachment.storagePath,
            label: attachment.label,
            mimeType: attachment.mimeType,
          })),
        });
      }
    }

    if (data.attachments.length) {
      await tx.attachment.createMany({
        data: data.attachments.map((attachment) => ({
          orderId: order.id,
          url: attachment.url,
          storagePath: attachment.storagePath,
          label: attachment.label,
          mimeType: attachment.mimeType,
          uploadedById: data.userId ?? null,
        })),
      });
    }

    if (data.notes?.trim() && data.userId) {
      await tx.note.create({
        data: {
          orderId: order.id,
          userId: data.userId,
          content: data.notes.trim(),
        },
      });
    }

    await tx.statusHistory.create({
      data: {
        orderId: order.id,
        from: 'RECEIVED',
        to: 'RECEIVED',
        userId: data.userId ?? null,
        reason: 'Created from repeat-order template.',
      },
    });

    return { id: order.id, partIdsByTemplatePartId: createdParts };
  });
}
