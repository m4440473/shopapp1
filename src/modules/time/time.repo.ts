import { prisma } from '@/lib/prisma';

export async function findActiveTimeEntryForUser(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
}

export async function findLatestTimeEntryForUserOrder(
  userId: string,
  orderId: string,
  partId?: string | null
) {
  return prisma.timeEntry.findFirst({
    where: {
      userId,
      orderId,
      ...(partId !== undefined ? { partId } : {}),
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function findLatestTimeEntriesForUserParts(userId: string, partIds: string[]) {
  if (!partIds.length) return [];
  return prisma.timeEntry.findMany({
    where: { userId, partId: { in: partIds } },
    orderBy: { startedAt: 'desc' },
  });
}

export async function findTimeEntryById(id: string) {
  return prisma.timeEntry.findUnique({ where: { id } });
}

export async function listTimeEntriesForOrderParts(orderId: string, partIds: string[]) {
  return prisma.timeEntry.findMany({
    where: {
      orderId,
      partId: { in: partIds },
      endedAt: { not: null },
    },
    select: { partId: true, startedAt: true, endedAt: true },
  });
}

export async function createTimeEntry(data: {
  orderId: string;
  partId?: string | null;
  userId: string;
  operation: string;
  startedAt?: Date;
}) {
  return prisma.timeEntry.create({
    data: {
      orderId: data.orderId,
      partId: data.partId ?? null,
      userId: data.userId,
      operation: data.operation,
      startedAt: data.startedAt ?? new Date(),
    },
  });
}

export async function closeTimeEntryById(id: string, endedAt: Date) {
  return prisma.timeEntry.updateMany({
    where: { id, endedAt: null },
    data: { endedAt },
  });
}
