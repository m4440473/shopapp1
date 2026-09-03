import { prisma } from '@/lib/prisma';

export async function listOrders({ where, take, cursor }: { where: Record<string, unknown>; take: number; cursor?: string | null }) {
  return prisma.order.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true, orderNumber: true, business: true, dueDate: true, receivedDate: true, createdAt: true, priority: true, status: true,
      customer: { select: { id: true, name: true } },
      assignedMachinist: { select: { id: true, name: true, email: true } },
      materialNeeded: true,
      materialOrdered: true,
      parts: { select: { quantity: true, currentDepartmentId: true } },
      checklist: {
        where: { isActive: true },
        select: { completed: true, departmentId: true, addon: { select: { name: true } } },
      },
      statusHistory: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}

export async function findOrderWithDetails(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      parts: {
        include: {
          material: true,
          procurementVendor: { select: { id: true, name: true } },
          currentDepartment: { select: { id: true, name: true } },
          attachments: true,
          charges: { include: { department: true } },
          partEvents: { orderBy: { createdAt: 'desc' }, take: 1 },
          assignments: {
            where: { isActive: true },
            orderBy: [{ createdAt: 'asc' }],
            include: {
              user: { select: { id: true, name: true, email: true } },
              assignedBy: { select: { id: true, name: true, email: true } },
            },
          },
          instructionReceipts: {
            orderBy: { acknowledgedAt: 'desc' },
            include: {
              user: { select: { id: true, name: true, email: true } },
              department: { select: { id: true, name: true } },
            },
          },
        },
      },
      checklist: {
        include: {
          addon: true, department: true, part: true, charge: true,
          toggledBy: { select: { id: true, name: true, email: true } },
          performedBy: { select: { id: true, name: true, email: true } },
        },
      },
      charges: { include: { department: true, part: true }, orderBy: { sortOrder: 'asc' } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'asc' }, include: { user: true } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } },
      partAttachments: { orderBy: { createdAt: 'desc' } },
      partTimeAdjustments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
      timeEntries: {
        orderBy: { startedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
          actions: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true, email: true } } } },
        },
      },
      assignedMachinist: true,
      vendor: true,
    },
  });
}
