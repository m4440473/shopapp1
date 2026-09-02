import 'server-only';
import { prisma } from '@/lib/prisma';

export async function readSystemHealthData(since: Date) {
  const [orderCount, quoteCount, jobGroups, activeImports, attempts] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.quote.count({ where: { createdAt: { gte: since } } }),
    prisma.drawingImportJob.groupBy({ by: ['status'], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    prisma.drawingImportJob.findMany({
      where: { status: { in: ['QUEUED', 'PROCESSING'] } }, orderBy: { updatedAt: 'asc' }, take: 20,
      select: { id: true, destination: true, customerName: true, stage: true, status: true, createdAt: true, updatedAt: true, lastHeartbeatAt: true },
    }),
    prisma.drawingExtractionAttempt.aggregate({
      where: { createdAt: { gte: since } }, _count: { _all: true }, _avg: { latencyMs: true }, _max: { latencyMs: true }, _sum: { calculatedCostUsd: true },
    }),
  ]);
  return { orderCount, quoteCount, jobGroups, activeImports, attempts };
}
