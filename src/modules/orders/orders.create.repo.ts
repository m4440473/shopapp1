import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import { prisma } from '@/lib/prisma';

export async function generateNextOrderNumber(business: BusinessCode): Promise<string> {
  const prefix = BUSINESS_PREFIX_BY_CODE[business] ?? business;
  // Business can change without renumbering an order; numbers remain globally reserved.
  const assigned = await prisma.order.findMany({
    select: { orderNumber: true },
    where: { orderNumber: { startsWith: `${prefix}-` } },
  });
  let maxValue = BigInt(1000);
  for (const candidate of assigned) {
    const suffix = candidate.orderNumber.slice(prefix.length + 1);
    if (!candidate.orderNumber.startsWith(`${prefix}-`) || !/^\d+$/.test(suffix)) continue;
    const numeric = BigInt(suffix);
    if (numeric > maxValue) maxValue = numeric;
  }
  return `${prefix}-${maxValue + BigInt(1)}`;
}

export async function findActiveOrderCustomFields({ fieldIds, business }: { fieldIds: string[]; business: BusinessCode }) {
  return prisma.customField.findMany({
    where: { id: { in: fieldIds }, entityType: 'ORDER', isActive: true, OR: [{ businessCode: business }, { businessCode: null }] },
    select: { id: true },
  });
}

export async function createOrderWithCustomFields({ orderData, customFieldValues, relatedData }: {
  orderData: Record<string, unknown>;
  customFieldValues: { fieldId: string; value: string }[];
  relatedData?: {
    initialDepartmentId?: string | null;
    parts: Array<{
      attachments: Array<Record<string, unknown>>;
      charges: Array<{ data: Record<string, unknown>; createChecklist: boolean }>;
      checklistItems: Array<Record<string, unknown>>;
    }>;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.order.create(orderData) as any;
    if (customFieldValues.length) {
      await tx.customFieldValue.createMany({ data: customFieldValues.map((value) => ({ fieldId: value.fieldId, entityId: created.id, value: value.value })) });
    }
    const createdParts = Array.isArray(created.parts) ? created.parts : [];
    for (const [index, partData] of (relatedData?.parts ?? []).entries()) {
      const partId = createdParts[index]?.id;
      if (!partId) continue;
      if (partData.attachments.length) {
        await tx.partAttachment.createMany({ data: partData.attachments.map((attachment) => ({ ...attachment, orderId: created.id, partId })) as any });
      }
      for (const chargeInput of partData.charges) {
        const charge = await tx.orderCharge.create({ data: { ...chargeInput.data, orderId: created.id, partId } as any });
        if (chargeInput.createChecklist) {
          await tx.orderChecklist.create({ data: { orderId: created.id, partId, chargeId: charge.id, addonId: charge.addonId, departmentId: charge.departmentId, completed: false, isActive: true } });
        }
      }
      for (const checklistItem of partData.checklistItems) {
        await tx.orderChecklist.create({ data: { ...checklistItem, orderId: created.id, partId, completed: false, isActive: true } as any });
      }
    }
    if (relatedData?.initialDepartmentId) {
      await tx.orderPart.updateMany({ where: { orderId: created.id, currentDepartmentId: null }, data: { currentDepartmentId: relatedData.initialDepartmentId, status: 'IN_PROGRESS' } });
    }
    return created;
  });
}
