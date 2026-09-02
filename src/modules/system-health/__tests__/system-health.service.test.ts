import { beforeEach, describe, expect, it, vi } from 'vitest';
const read = vi.hoisted(() => vi.fn());
vi.mock('../system-health.repo', () => ({ readSystemHealthData: read }));
import { getSystemHealthSnapshot } from '../system-health.service';
describe('system health monitor', () => {
  beforeEach(() => read.mockResolvedValue({ orderCount: 3, quoteCount: 2, jobGroups: [{ status: 'READY_FOR_REVIEW', _count: { _all: 4 } }], activeImports: [], attempts: { _count: { _all: 5 }, _avg: { latencyMs: 1250 }, _max: { latencyMs: 3000 }, _sum: { calculatedCostUsd: 1.23456 } } }));
  it('returns bounded operational metrics without configuration or log content', async () => {
    const result = await getSystemHealthSnapshot(new Date('2026-09-01T05:00:00Z'));
    expect(result.activity24Hours).toMatchObject({ ordersCreated: 3, quotesCreated: 2, aiAttempts: 5, averageAiLatencyMs: 1250, aiCostUsd: 1.2346 });
    expect(JSON.stringify(result)).not.toMatch(/secret|apiKey|password|log/i);
  });
});
