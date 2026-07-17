import { prisma } from '@/lib/prisma';

export async function findActiveTimeEntryForUser(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
}

export async function listActiveTimeEntriesForUser(userId: string) {
  return prisma.timeEntry.findMany({
    where: { userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
}

export async function findActiveTimeEntryForUserDepartment(userId: string, departmentId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, departmentId, endedAt: null },
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

export async function listActiveTimeEntriesDetailed() {
  return prisma.timeEntry.findMany({
    where: { endedAt: null },
    orderBy: [{ startedAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      order: { select: { id: true, orderNumber: true } },
      part: { select: { id: true, partNumber: true, partName: true } },
      department: { select: { id: true, name: true } },
    },
  });
}

export async function listActiveTimeEntriesForPart(partId: string) {
  return prisma.timeEntry.findMany({
    where: { partId, endedAt: null },
    orderBy: { startedAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
    },
  });
}

export async function listTimeEntriesForPartsDetailed(partIds: string[]) {
  if (!partIds.length) return [];
  return prisma.timeEntry.findMany({
    where: { partId: { in: partIds } },
    orderBy: [{ startedAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      department: { select: { id: true, name: true } },
      actions: {
        orderBy: { createdAt: 'asc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function createTimeEntryWithAction(data: {
  orderId: string;
  partId: string;
  departmentId: string;
  workerUserId: string;
  actorUserId: string;
  operation: string;
  startedAt?: Date;
}) {
  const startedAt = data.startedAt ?? new Date();
  return prisma.$transaction(async (tx) => {
    const active = await tx.timeEntry.findFirst({
      where: { userId: data.workerUserId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (active) return { entry: null, activeEntry: active };

    const entry = await tx.timeEntry.create({
      data: {
        orderId: data.orderId,
        partId: data.partId,
        departmentId: data.departmentId,
        userId: data.workerUserId,
        operation: data.operation,
        startedAt,
      },
    });
    await tx.timeEntryAction.create({
      data: {
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: 'START',
        createdAt: startedAt,
      },
    });
    return { entry, activeEntry: null };
  });
}

export async function switchTimeEntryWithActions(data: {
  orderId: string;
  partId: string;
  departmentId: string;
  workerUserId: string;
  actorUserId: string;
  operation: string;
  switchedAt?: Date;
}) {
  const switchedAt = data.switchedAt ?? new Date();
  return prisma.$transaction(async (tx) => {
    const activeEntry = await tx.timeEntry.findFirst({
      where: { userId: data.workerUserId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (activeEntry) {
      await tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: { endedAt: switchedAt },
      });
      await tx.timeEntryAction.create({
        data: {
          timeEntryId: activeEntry.id,
          actorUserId: data.actorUserId,
          action: 'PAUSE',
          reason: 'Switched to urgent or higher-priority work.',
          metadata: JSON.stringify({
            switchedToOrderId: data.orderId,
            switchedToPartId: data.partId,
          }),
          createdAt: switchedAt,
        },
      });
    }

    const entry = await tx.timeEntry.create({
      data: {
        orderId: data.orderId,
        partId: data.partId,
        departmentId: data.departmentId,
        userId: data.workerUserId,
        operation: data.operation,
        startedAt: switchedAt,
      },
    });
    await tx.timeEntryAction.create({
      data: {
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: activeEntry ? 'SWITCH_START' : 'START',
        metadata: activeEntry
          ? JSON.stringify({
              switchedFromEntryId: activeEntry.id,
              switchedFromOrderId: activeEntry.orderId,
              switchedFromPartId: activeEntry.partId,
            })
          : null,
        createdAt: switchedAt,
      },
    });

    return { entry, previousEntry: activeEntry ? { ...activeEntry, endedAt: switchedAt } : null };
  });
}

export async function closeWorkerTimeEntryWithAction(data: {
  workerUserId: string;
  actorUserId: string;
  entryId?: string | null;
  action: 'PAUSE' | 'FINISH' | 'ADMIN_CLOSE';
  reason?: string | null;
  endedAt?: Date;
}) {
  const endedAt = data.endedAt ?? new Date();
  return prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: {
        userId: data.workerUserId,
        endedAt: null,
        ...(data.entryId ? { id: data.entryId } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!entry) return null;

    const updated = await tx.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt },
    });
    await tx.timeEntryAction.create({
      data: {
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: data.action,
        reason: data.reason ?? null,
        createdAt: endedAt,
      },
    });
    return updated;
  });
}

export async function updateClosedTimeEntryWithAudit(data: {
  entryId: string;
  actorUserId: string;
  startedAt: Date;
  endedAt: Date;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.findUnique({ where: { id: data.entryId } });
    if (!entry || !entry.endedAt) return null;

    const overlap = await tx.timeEntry.findFirst({
      where: {
        id: { not: entry.id },
        userId: entry.userId,
        startedAt: { lt: data.endedAt },
        OR: [{ endedAt: null }, { endedAt: { gt: data.startedAt } }],
      },
    });
    if (overlap) return { entry: null, overlap };

    const updated = await tx.timeEntry.update({
      where: { id: entry.id },
      data: { startedAt: data.startedAt, endedAt: data.endedAt },
    });
    await tx.timeEntryAction.create({
      data: {
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: 'CORRECT',
        reason: data.reason,
        metadata: JSON.stringify({
          before: { startedAt: entry.startedAt, endedAt: entry.endedAt },
          after: { startedAt: data.startedAt, endedAt: data.endedAt },
        }),
      },
    });
    return { entry: updated, overlap: null };
  });
}

export async function createTimeEntry(data: {
  orderId: string;
  partId?: string | null;
  departmentId?: string | null;
  userId: string;
  operation: string;
  startedAt?: Date;
}) {
  return prisma.timeEntry.create({
    data: {
      orderId: data.orderId,
      partId: data.partId ?? null,
      departmentId: data.departmentId ?? null,
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


export async function updateClosedTimeEntryById(
  id: string,
  data: { startedAt: Date; endedAt: Date }
) {
  const result = await prisma.timeEntry.updateMany({
    where: { id, endedAt: { not: null } },
    data: { startedAt: data.startedAt, endedAt: data.endedAt },
  });

  if (result.count === 0) return null;
  return prisma.timeEntry.findUnique({ where: { id } });
}
