import { prisma } from '@/lib/prisma';

type ChecklistKey = {
  addonId: string;
  partId: string | null;
};

function buildChecklistKey(value: ChecklistKey) {
  return `${value.addonId}::${value.partId ?? 'order'}`;
}

export async function syncChecklistForOrder(orderId: string) {
  const [charges, checklist] = await prisma.$transaction([
    prisma.orderCharge.findMany({
      where: { orderId, addonId: { not: null } },
      select: { addonId: true, partId: true },
    }),
    prisma.orderChecklist.findMany({
      where: { orderId },
      select: { id: true, addonId: true, partId: true, isActive: true },
    }),
  ]);

  const chargeKeys = new Set(
    charges
      .filter((charge) => Boolean(charge.addonId))
      .map((charge) => buildChecklistKey({ addonId: charge.addonId!, partId: charge.partId ?? null }))
  );

  const checklistByKey = new Map(
    checklist.map((item) => [buildChecklistKey({ addonId: item.addonId, partId: item.partId ?? null }), item])
  );

  const toCreate = charges.filter((charge) => {
    const key = buildChecklistKey({ addonId: charge.addonId!, partId: charge.partId ?? null });
    return !checklistByKey.has(key);
  });

  const toActivate = checklist.filter((item) => {
    const key = buildChecklistKey({ addonId: item.addonId, partId: item.partId ?? null });
    return chargeKeys.has(key) && !item.isActive;
  });

  const toDeactivate = checklist.filter((item) => {
    const key = buildChecklistKey({ addonId: item.addonId, partId: item.partId ?? null });
    return !chargeKeys.has(key) && item.isActive;
  });

  await prisma.$transaction([
    ...(toCreate.length
      ? [
          prisma.orderChecklist.createMany({
            data: toCreate.map((charge) => ({
              orderId,
              addonId: charge.addonId!,
              partId: charge.partId ?? null,
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
  ]);
}
