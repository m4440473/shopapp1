import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import { prisma } from '@/lib/prisma';

type ChecklistKey = {
  chargeId: string;
};

function buildChecklistKey(value: ChecklistKey) {
  return value.chargeId;
}

export async function generateNextOrderNumber(business: BusinessCode): Promise<string> {
  const recent = await prisma.order.findMany({
    select: { orderNumber: true },
    where: { business },
    orderBy: { orderNumber: 'desc' },
    take: 200,
  });

  let maxValue = 1000;
  for (const candidate of recent) {
    const numeric = parseInt(candidate.orderNumber.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      maxValue = Math.max(maxValue, numeric);
    }
  }

  const prefix = BUSINESS_PREFIX_BY_CODE[business] ?? business;
  return `${prefix}-${maxValue + 1}`;
}

export async function syncChecklistForOrder(orderId: string) {
  const [charges, checklist] = await prisma.$transaction([
    prisma.orderCharge.findMany({
      where: { orderId },
      select: { id: true, partId: true, departmentId: true, addonId: true, completedAt: true },
    }),
    prisma.orderChecklist.findMany({
      where: { orderId, chargeId: { not: null } },
      select: { id: true, chargeId: true, isActive: true, completed: true },
    }),
  ]);

  const chargeKeys = new Set(charges.map((charge) => buildChecklistKey({ chargeId: charge.id })));

  const checklistByKey = new Map(
    checklist
      .filter((item) => item.chargeId)
      .map((item) => [buildChecklistKey({ chargeId: item.chargeId! }), item])
  );
  const chargeById = new Map<string, (typeof charges)[number]>(charges.map((charge) => [charge.id, charge]));

  const toCreate = charges.filter((charge) => !checklistByKey.has(buildChecklistKey({ chargeId: charge.id })));
  const toActivate = checklist.filter((item) => {
    if (!item.chargeId) return false;
    return chargeKeys.has(buildChecklistKey({ chargeId: item.chargeId })) && !item.isActive;
  });
  const toDeactivate = checklist.filter((item) => {
    if (!item.chargeId) return false;
    return !chargeKeys.has(buildChecklistKey({ chargeId: item.chargeId })) && item.isActive;
  });
  const toSyncCompletion = checklist.flatMap((item) => {
    if (!item.chargeId) return [];
    const charge = chargeById.get(item.chargeId);
    if (!charge) return [];
    const completed = Boolean(charge.completedAt);
    if (item.completed === completed) return [];
    return [{ id: item.id, completed }];
  });

  await prisma.$transaction([
    ...(toCreate.length
      ? [
          prisma.orderChecklist.createMany({
            data: toCreate.map((charge) => ({
              orderId,
              partId: charge.partId ?? null,
              chargeId: charge.id,
              departmentId: charge.departmentId,
              addonId: charge.addonId ?? null,
              completed: Boolean(charge.completedAt),
              isActive: true,
            })),
          }),
        ]
      : []),
    ...(toActivate.length
      ? [
          prisma.orderChecklist.updateMany({
            where: { id: { in: toActivate.map((item) => item.id) } },
            data: { isActive: true },
          }),
        ]
      : []),
    ...(toDeactivate.length
      ? [
          prisma.orderChecklist.updateMany({
            where: { id: { in: toDeactivate.map((item) => item.id) } },
            data: { isActive: false },
          }),
        ]
      : []),
    ...toSyncCompletion.map((entry) =>
      prisma.orderChecklist.update({
        where: { id: entry.id },
        data: { completed: entry.completed },
      })
    ),
  ]);
}

export async function listOrders({
  where,
  take,
  cursor,
}: {
  where: Record<string, unknown>;
  take: number;
  cursor?: string | null;
}) {
  return prisma.order.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      orderNumber: true,
      business: true,
      dueDate: true,
      receivedDate: true,
      priority: true,
      status: true,
      customer: { select: { id: true, name: true } },
      assignedMachinist: { select: { id: true, name: true, email: true } },
      materialNeeded: true,
      materialOrdered: true,
      parts: { select: { quantity: true } },
      checklist: {
        where: { isActive: true },
        select: {
          completed: true,
          addon: { select: { name: true } },
        },
      },
      statusHistory: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function findActiveOrderCustomFields({
  fieldIds,
  business,
}: {
  fieldIds: string[];
  business: BusinessCode;
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

export async function createOrderWithCustomFields({
  orderData,
  customFieldValues,
}: {
  orderData: Record<string, unknown>;
  customFieldValues: { fieldId: string; value: string }[];
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.order.create(orderData);

    if (customFieldValues.length) {
      await tx.customFieldValue.createMany({
        data: customFieldValues.map((value) => ({
          fieldId: value.fieldId,
          entityId: created.id,
          value: value.value,
        })),
      });
    }

    return created;
  });
}

export async function findOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });
}

export async function findOrderWithDetails(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      parts: { include: { material: true, attachments: true, charges: { include: { department: true } } } },
      checklist: { include: { addon: true, department: true, part: true, charge: true } },
      charges: { include: { department: true, part: true }, orderBy: { sortOrder: 'asc' } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'asc' }, include: { user: true } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } },
      partAttachments: { orderBy: { createdAt: 'desc' } },
      assignedMachinist: true,
      vendor: true,
    },
  });
}

export async function updateOrder(id: string, data: Record<string, unknown>) {
  return prisma.order.update({
    where: { id },
    data,
  });
}

export async function findOrderStatus(id: string) {
  return prisma.order.findUnique({ where: { id }, select: { status: true } });
}

export async function updateOrderStatus(id: string, status: string) {
  return prisma.order.update({ where: { id }, data: { status } });
}

export async function createStatusHistoryEntry(data: Record<string, unknown>) {
  return prisma.statusHistory.create({ data });
}

export async function updateOrderAssignee(id: string, machinistId: string | null) {
  return prisma.order.update({
    where: { id },
    data: { assignedMachinistId: machinistId },
    select: {
      id: true,
      assignedMachinistId: true,
      assignedMachinist: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createOrderNote(orderId: string, userId: string, content: string) {
  return prisma.note.create({ data: { orderId, userId, content } });
}

export async function findChecklistById(checklistId: string) {
  return prisma.orderChecklist.findUnique({ where: { id: checklistId } });
}

export async function findChecklistByCharge(orderId: string, chargeId: string) {
  return prisma.orderChecklist.findFirst({ where: { orderId, chargeId, isActive: true } });
}

export async function findChecklistByAddon(orderId: string, addonId: string, partId: string | null) {
  return prisma.orderChecklist.findFirst({
    where: { orderId, addonId, partId, isActive: true },
  });
}

export async function findChargeById(chargeId: string) {
  return prisma.orderCharge.findUnique({
    where: { id: chargeId },
    select: { id: true, name: true },
  });
}

export async function findAddonById(addonId: string) {
  return prisma.addon.findUnique({
    where: { id: addonId },
    select: { id: true, name: true },
  });
}

export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
}

export async function updateChecklistCompletion({
  checklistId,
  checked,
  toggledById,
  chargeId,
}: {
  checklistId: string;
  checked: boolean;
  toggledById: string | null;
  chargeId?: string | null;
}) {
  await prisma.$transaction([
    prisma.orderChecklist.update({
      where: { id: checklistId },
      data: { completed: checked, toggledById },
    }),
    ...(chargeId
      ? [
          prisma.orderCharge.update({
            where: { id: chargeId },
            data: { completedAt: checked ? new Date() : null },
          }),
        ]
      : []),
  ]);
}

export async function listChecklistItems(orderId: string) {
  return prisma.orderChecklist.findMany({
    where: { orderId },
    include: {
      addon: true,
      department: true,
      part: true,
      charge: { select: { id: true, name: true, kind: true, completedAt: true, partId: true, departmentId: true } },
    },
  });
}

export async function findOrderSummary(id: string) {
  return prisma.order.findUnique({
    select: { id: true, poNumber: true },
    where: { id },
  });
}

export async function findOrderPartSummary(orderId: string, partId: string) {
  return prisma.orderPart.findFirst({
    where: { id: partId, orderId },
    select: { id: true, partNumber: true },
  });
}

export async function createOrderPartWithCharges({
  orderId,
  partData,
  sourcePartId,
  userId,
  noteBuilder,
}: {
  orderId: string;
  partData: {
    partNumber: string;
    quantity: number;
    materialId?: string | null;
    stockSize?: string | null;
    cutLength?: string | null;
    notes?: string | null;
  };
  sourcePartId?: string | null;
  userId?: string | null;
  noteBuilder?: (input: { part: { partNumber: string; quantity: number }; copiedCharges: number }) => string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const part = await tx.orderPart.create({
      data: {
        orderId,
        partNumber: partData.partNumber,
        quantity: partData.quantity,
        materialId: partData.materialId ?? null,
        stockSize: partData.stockSize ?? null,
        cutLength: partData.cutLength ?? null,
        notes: partData.notes ?? null,
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

export async function listOrderPartsByIds(orderId: string, partIds: string[]) {
  return prisma.orderPart.findMany({
    where: { orderId, id: { in: partIds } },
    select: { id: true, currentDepartmentId: true },
  });
}

export async function moveOrderPartsToDepartment({
  orderId,
  partIds,
  toDepartmentId,
  statusHistory,
}: {
  orderId: string;
  partIds: string[];
  toDepartmentId: string;
  statusHistory: { from: string; to: string; userId?: string | null; reason?: string | null };
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.orderPart.updateMany({
      where: { orderId, id: { in: partIds } },
      data: { currentDepartmentId: toDepartmentId },
    });

    await tx.statusHistory.create({
      data: {
        orderId,
        from: statusHistory.from,
        to: statusHistory.to,
        userId: statusHistory.userId ?? null,
        reason: statusHistory.reason ?? null,
      },
    });

    return updated;
  });
}

export async function updateOrderPart(partId: string, data: Record<string, unknown>) {
  return prisma.orderPart.update({ where: { id: partId }, data });
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

export async function listOrderCharges(orderId: string) {
  return prisma.orderCharge.findMany({
    where: { orderId },
    include: { department: true, part: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function findOrderPartForCharge(orderId: string, partId: string) {
  return prisma.orderPart.findFirst({
    where: { id: partId, orderId },
    select: { id: true },
  });
}

export async function findDepartmentById(departmentId: string) {
  return prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, sortOrder: true, isActive: true },
  });
}

export async function findActiveDepartmentById(departmentId: string) {
  return prisma.department.findFirst({
    where: { id: departmentId, isActive: true },
    select: { id: true, name: true, sortOrder: true },
  });
}

export async function listDepartmentsOrdered() {
  return prisma.department.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, sortOrder: true, isActive: true },
  });
}

export async function findAddonDepartment(addonId: string) {
  return prisma.addon.findUnique({
    where: { id: addonId },
    select: { id: true, departmentId: true },
  });
}

export async function createOrderCharge(data: Record<string, unknown>) {
  return prisma.orderCharge.create(data);
}

export async function findOrderCharge(orderId: string, chargeId: string) {
  return prisma.orderCharge.findFirst({
    where: { id: chargeId, orderId },
    select: { id: true, partId: true, kind: true },
  });
}

export async function updateOrderCharge(chargeId: string, data: Record<string, unknown>) {
  return prisma.orderCharge.update({
    where: { id: chargeId },
    data,
    include: { department: true, part: true },
  });
}

export async function deleteOrderChargeWithChecklist(chargeId: string) {
  await prisma.$transaction([
    prisma.orderChecklist.updateMany({
      where: { chargeId },
      data: { isActive: false },
    }),
    prisma.orderCharge.delete({ where: { id: chargeId } }),
  ]);
}

export async function createOrderAttachment(data: Record<string, unknown>) {
  return prisma.attachment.create(data);
}

export async function findPartById(partId: string) {
  return prisma.orderPart.findUnique({ where: { id: partId }, select: { id: true } });
}

export async function listPartAttachments(partId: string) {
  return prisma.partAttachment.findMany({
    where: { partId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findPartWithOrderInfo(partId: string) {
  return prisma.orderPart.findUnique({
    where: { id: partId },
    select: {
      id: true,
      orderId: true,
      order: {
        select: {
          orderNumber: true,
          business: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
}

export async function createPartAttachment(data: Record<string, unknown>) {
  return prisma.partAttachment.create(data);
}

export async function findPartAttachment(partId: string, attachmentId: string) {
  return prisma.partAttachment.findFirst({
    where: { id: attachmentId, partId },
    select: { id: true },
  });
}

export async function updatePartAttachment(attachmentId: string, data: Record<string, unknown>) {
  return prisma.partAttachment.update({
    where: { id: attachmentId },
    data,
  });
}

export async function deletePartAttachment(attachmentId: string) {
  return prisma.partAttachment.delete({ where: { id: attachmentId } });
}

export async function listAddons({
  where,
  take,
  cursor,
}: {
  where?: Record<string, unknown>;
  take: number;
  cursor?: string | null;
}) {
  return prisma.addon.findMany({
    where,
    orderBy: { name: 'asc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function listReadyOrderPartsForDepartment(departmentId: string) {
  return prisma.orderPart.findMany({
    where: {
      currentDepartmentId: departmentId,
      checklistItems: {
        some: {
          departmentId,
          isActive: true,
          completed: false,
        },
      },
    },
    select: {
      id: true,
      partNumber: true,
      quantity: true,
      orderId: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          dueDate: true,
          status: true,
          customer: { select: { name: true } },
          parts: { select: { id: true } },
        },
      },
    },
  });
}
