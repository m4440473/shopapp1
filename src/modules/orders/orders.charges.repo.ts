import { prisma } from '@/lib/prisma';

export async function listOrderCharges(orderId: string) {
  return prisma.orderCharge.findMany({
    where: { orderId },
    include: { department: true, part: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
