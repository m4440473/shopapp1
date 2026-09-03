import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
type DbClient = PrismaClient | any;
export async function findOrderStatus(id: string) { return prisma.order.findUnique({ where: { id }, select: { status: true } }); }
export async function updateOrderStatus(id: string, status: string) { return prisma.order.update({ where: { id }, data: { status } }); }
export async function createStatusHistoryEntry(data: Record<string, unknown>) { return prisma.statusHistory.create({ data }); }
export async function findOrderForWorkflowStatus(orderId: string, db: DbClient = prisma) {
  return db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      parts: { select: { id: true, status: true } },
      checklist: { where: { isActive: true }, select: { id: true, partId: true, completed: true } },
      timeEntries: { select: { id: true }, take: 1 },
      partEvents: {
        where: { type: { in: ['TIMER_STARTED', 'TIMER_FINISHED', 'DEPARTMENT_ADVANCED', 'DEPARTMENT_SET_MANUAL', 'DEPARTMENT_REWORKED', 'CHECKLIST_TOGGLED'] } },
        select: { id: true },
        take: 1,
      },
    },
  });
}
