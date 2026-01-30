/**
 * One-time backfill for OrderPart.currentDepartmentId based on active, incomplete checklist items.
 * Usage:
 *   npx ts-node scripts/backfill-current-department.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function main() {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, sortOrder: true },
  });

  if (!departments.length) {
    console.log('No active departments found. Nothing to backfill.');
    return;
  }

  const parts = await prisma.orderPart.findMany({
    where: { currentDepartmentId: null },
    select: {
      id: true,
      checklistItems: {
        where: { isActive: true, departmentId: { not: null } },
        select: { departmentId: true, completed: true, isActive: true },
      },
    },
  });

  let updatedCount = 0;
  for (const part of parts) {
    if (!part.checklistItems.length) continue;
    let targetDepartmentId: string | null = null;
    for (const department of departments) {
      const entries = part.checklistItems.filter(
        (item) => item.departmentId === department.id && item.isActive !== false,
      );
      if (!entries.length) continue;
      if (entries.some((item) => item.completed === false)) {
        targetDepartmentId = department.id;
        break;
      }
    }
    if (!targetDepartmentId) continue;
    await prisma.orderPart.update({
      where: { id: part.id },
      data: { currentDepartmentId: targetDepartmentId },
    });
    updatedCount += 1;
  }

  console.log(`Backfill complete. Updated ${updatedCount} part(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
