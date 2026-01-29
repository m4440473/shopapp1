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
