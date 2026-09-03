import 'server-only';
import os from 'node:os';
import { readSystemHealthData } from './system-health.repo';

export async function getSystemHealthSnapshot(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
  const data = await readSystemHealthData(dayAgo);
  const memory = process.memoryUsage();
  return {
    checkedAt: now.toISOString(),
    application: { status: 'ok' as const, uptimeSeconds: Math.round(process.uptime()), nodeVersion: process.version, pid: process.pid },
    host: { hostname: os.hostname(), uptimeSeconds: Math.round(os.uptime()), freeMemoryBytes: os.freemem(), totalMemoryBytes: os.totalmem(), processRssBytes: memory.rss, processHeapUsedBytes: memory.heapUsed },
    activity24Hours: {
      ordersCreated: data.orderCount, quotesCreated: data.quoteCount,
      importsByStatus: Object.fromEntries(data.jobGroups.map((group) => [group.status, group._count._all])),
      aiAttempts: data.attempts._count._all, averageAiLatencyMs: Math.round(data.attempts._avg.latencyMs ?? 0), maximumAiLatencyMs: data.attempts._max.latencyMs ?? 0,
      aiCostUsd: Number((data.attempts._sum.calculatedCostUsd ?? 0).toFixed(4)),
    },
    activeImports: data.activeImports.map((job) => ({ ...job, createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(), lastHeartbeatAt: job.lastHeartbeatAt?.toISOString() ?? null })),
  };
}
