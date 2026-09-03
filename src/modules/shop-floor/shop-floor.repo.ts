import { prisma } from '@/lib/prisma';
import { APP_SETTINGS_SINGLETON_ID } from '@/lib/app-settings';

export async function getShopFloorDisplayOptionsJson() {
  const settings = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    update: {},
    create: { id: APP_SETTINGS_SINGLETON_ID },
    select: { shopFloorDisplayOptions: true },
  });
  return settings.shopFloorDisplayOptions;
}

export async function saveShopFloorDisplayOptionsJson(shopFloorDisplayOptions: string) {
  return prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    update: { shopFloorDisplayOptions },
    create: { id: APP_SETTINGS_SINGLETON_ID, shopFloorDisplayOptions },
    select: { shopFloorDisplayOptions: true },
  });
}

const SHOP_FLOOR_SUMMARY_EVENT_TYPES = [
  'DEPARTMENT_ADVANCED',
  'DEPARTMENT_SET_MANUAL',
  'DEPARTMENT_REWORKED',
  'MATERIAL_STATUS_CHANGED',
] as const;

export async function listRecentShopFloorEvents(since: Date, take = 40) {
  return prisma.partEvent.findMany({
    where: {
      createdAt: { gte: since },
      type: { in: [...SHOP_FLOOR_SUMMARY_EVENT_TYPES] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(take, 1), 100),
    select: {
      id: true,
      type: true,
      message: true,
      meta: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      part: {
        select: {
          id: true,
          partNumber: true,
          partName: true,
          materialStatus: true,
          procurementVendor: { select: { id: true, name: true } },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
}

export async function listShopFloorDepartmentNames() {
  return prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getWaitingStockSnapshot(take = 12) {
  const where = {
    materialStatus: 'WAITING_ON_STOCK',
    status: { not: 'COMPLETE' },
    order: { status: { not: 'CLOSED' } },
  } as const;
  const [count, items] = await Promise.all([
    prisma.orderPart.count({ where }),
    prisma.orderPart.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(take, 1), 50),
      select: {
        id: true,
        partNumber: true,
        partName: true,
        updatedAt: true,
        procurementVendor: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            dueDate: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  return { count, items };
}
