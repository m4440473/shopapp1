import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = PrismaClient | any;

export type OrderPartCreateRecord = {
  partNumber: string;
  partName?: string | null;
  quantity: number;
  materialId?: string | null;
  drawingMaterialText?: string | null;
  drawingFinishText?: string | null;
  finish?: string | null;
  materialStatus?: string;
  inventoryLocation?: string | null;
  materialNotes?: string | null;
  procurementVendorId?: string | null;
  stockSize?: string | null;
  cutLength?: string | null;
  finalPartLength?: string | null;
  partWidth?: string | null;
  partThickness?: string | null;
  notes?: string | null;
  workInstructions?: string | null;
};

export async function createOrderPartWithCharges({
  orderId,
  partData,
  sourcePartId,
  userId,
  noteBuilder,
}: {
  orderId: string;
  partData: OrderPartCreateRecord;
  sourcePartId?: string | null;
  userId?: string | null;
  noteBuilder?: (input: { part: { partNumber: string; quantity: number }; copiedCharges: number }) => string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const part = await tx.orderPart.create({
      data: {
        orderId,
        partNumber: partData.partNumber,
        partName: partData.partName ?? null,
        quantity: partData.quantity,
        materialId: partData.materialId ?? null,
        drawingMaterialText: partData.drawingMaterialText ?? null,
        drawingFinishText: partData.drawingFinishText ?? null,
        finish: partData.finish ?? null,
        materialStatus: partData.materialStatus ?? 'UNREVIEWED',
        inventoryLocation: partData.inventoryLocation ?? null,
        materialNotes: partData.materialNotes ?? null,
        procurementVendorId: partData.procurementVendorId ?? null,
        stockSize: partData.stockSize ?? null,
        cutLength: partData.cutLength ?? null,
        finalPartLength: partData.finalPartLength ?? null,
        partWidth: partData.partWidth ?? null,
        partThickness: partData.partThickness ?? null,
        notes: partData.notes ?? null,
        workInstructions: partData.workInstructions ?? null,
      },
    });

    let copiedCharges = 0;
    if (sourcePartId) {
      const charges = await tx.orderCharge.findMany({
        where: { orderId, partId: sourcePartId },
        select: {
          departmentId: true,
          addonId: true,
          kind: true,
          name: true,
          description: true,
          quantity: true,
          unitPrice: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (charges.length) {
        await tx.orderCharge.createMany({
          data: charges.map((charge) => ({
            orderId,
            partId: part.id,
            departmentId: charge.departmentId,
            addonId: charge.addonId ?? null,
            kind: charge.kind,
            name: charge.name,
            description: charge.description ?? null,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            sortOrder: charge.sortOrder ?? 0,
          })),
        });
        copiedCharges = charges.length;
      }
    }

    if (userId && noteBuilder) {
      const noteContent = noteBuilder({ part, copiedCharges });
      if (noteContent) {
        await tx.note.create({
          data: {
            orderId,
            userId,
            content: noteContent,
          },
        });
      }
    }

    return { part, copiedCharges };
  });
}

export async function findOrderPart(orderId: string, partId: string) {
  return prisma.orderPart.findFirst({ where: { id: partId, orderId } });
}

export async function updateOrderPart(partId: string, data: Record<string, unknown>, db: DbClient = prisma) {
  return db.orderPart.update({ where: { id: partId }, data });
}

export async function countOrderParts(orderId: string) {
  return prisma.orderPart.count({ where: { orderId } });
}

export async function findOrderPartWithCharges(orderId: string, partId: string) {
  return prisma.orderPart.findFirst({
    where: { id: partId, orderId },
    select: { id: true, partNumber: true, quantity: true, charges: { select: { id: true } } },
  });
}

export async function deleteOrderPartWithRelations({
  orderId,
  partId,
  chargeIds,
  noteContent,
  userId,
}: {
  orderId: string;
  partId: string;
  chargeIds: string[];
  noteContent?: string | null;
  userId?: string | null;
}) {
  await prisma.$transaction([
    ...(chargeIds.length
      ? [
          prisma.orderChecklist.updateMany({
            where: { chargeId: { in: chargeIds } },
            data: { isActive: false },
          }),
          prisma.orderCharge.deleteMany({ where: { id: { in: chargeIds } } }),
        ]
      : []),
    prisma.orderChecklist.updateMany({
      where: { partId },
      data: { isActive: false },
    }),
    prisma.partAttachment.deleteMany({ where: { partId } }),
    prisma.orderPart.delete({ where: { id: partId } }),
    ...(noteContent && userId
      ? [
          prisma.note.create({
            data: {
              orderId,
              userId,
              content: noteContent,
            },
          }),
        ]
      : []),
  ]);
}
