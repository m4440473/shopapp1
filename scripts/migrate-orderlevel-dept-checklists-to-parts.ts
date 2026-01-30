/**
 * One-time migration to convert order-level department checklist items into per-part items.
 * Usage:
 *   npx ts-node scripts/migrate-orderlevel-dept-checklists-to-parts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function main() {
  const violatingItems = await prisma.orderChecklist.findMany({
    where: { departmentId: { not: null }, partId: null },
    include: {
      order: { select: { parts: { select: { id: true } } } },
      charge: { select: { id: true, partId: true } },
    },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (const item of violatingItems) {
    if (!item.departmentId) continue;

    if (item.chargeId) {
      const chargePartId = item.charge?.partId ?? null;
      if (chargePartId) {
        if (item.partId !== chargePartId) {
          await prisma.orderChecklist.update({
            where: { id: item.id },
            data: { partId: chargePartId },
          });
          updatedCount += 1;
        }
      } else {
        await prisma.orderChecklist.delete({ where: { id: item.id } });
        deletedCount += 1;
      }
      continue;
    }

    const partIds = item.order?.parts?.map((part) => part.id) ?? [];
    for (const partId of partIds) {
      const existing = await prisma.orderChecklist.findFirst({
        where: {
          orderId: item.orderId,
          partId,
          departmentId: item.departmentId,
          addonId: item.addonId ?? null,
          chargeId: null,
        },
      });
      if (existing) continue;
      await prisma.orderChecklist.create({
        data: {
          orderId: item.orderId,
          partId,
          departmentId: item.departmentId,
          addonId: item.addonId ?? null,
          chargeId: null,
          completed: false,
          isActive: item.isActive,
        },
      });
      createdCount += 1;
    }

    await prisma.orderChecklist.delete({ where: { id: item.id } });
    deletedCount += 1;
  }

  console.log(
    `Migration complete. Created ${createdCount}, updated ${updatedCount}, deleted ${deletedCount} checklist item(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
