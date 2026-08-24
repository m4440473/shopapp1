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
