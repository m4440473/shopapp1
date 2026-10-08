import 'server-only';
import path from 'node:path';
import { appendFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { assistantDataRoot } from './assistant.storage';
import type { OllamaGenerationMetrics } from './assistant.ollama';

export type AssistantToolMetric = {
  name: string;
  outcome?: 'success' | 'error';
  queryMs?: number;
  groupingMs?: number;
  wallMs: number;
  payloadBytes?: number;
  groupResultCount?: number;
};

export type AssistantRequestMetric = {
  outcome: 'success' | 'error' | 'aborted';
  route: 'direct' | 'model';
  totalMs: number;
  toolRounds?: number;
  modelCalls?: OllamaGenerationMetrics[];
  tools?: AssistantToolMetric[];
};

const maxBytes = 5 * 1024 * 1024;
let pending = Promise.resolve();

/** Appends operational measurements only. This API deliberately accepts no prompts, results, conversation IDs, or user IDs. */
export function appendAssistantRequestMetric(metric: AssistantRequestMetric): Promise<void> {
  const safe = {
    timestamp: new Date().toISOString(), outcome: metric.outcome, route: metric.route, totalMs: finite(metric.totalMs),
    toolRounds: finite(metric.toolRounds),
    modelCalls: metric.modelCalls?.slice(0, 8).map(item => ({
      wallMs: finite(item.wallMs), promptEvalCount: finite(item.promptEvalCount), evalCount: finite(item.evalCount),
      loadDurationNs: finite(item.loadDurationNs), promptEvalDurationNs: finite(item.promptEvalDurationNs),
      evalDurationNs: finite(item.evalDurationNs), totalDurationNs: finite(item.totalDurationNs),
    })),
    tools: metric.tools?.slice(0, 16).map(item => ({
      name: /^[a-z][a-z0-9_]{0,63}$/i.test(item.name) ? item.name : 'unknown', queryMs: finite(item.queryMs),
      groupingMs: finite(item.groupingMs), wallMs: finite(item.wallMs), payloadBytes: finite(item.payloadBytes),
      groupResultCount: finite(item.groupResultCount),
      outcome: item.outcome,
    })),
  };
  pending = pending.catch(() => undefined).then(async () => {
    const directory = path.join(assistantDataRoot(), 'metrics');
    const target = path.join(directory, 'requests.jsonl');
    await mkdir(directory, { recursive: true });
    if ((await stat(target).catch(() => undefined))?.size >= maxBytes) {
      const rotated = path.join(directory, 'requests.1.jsonl');
      await unlink(rotated).catch(() => undefined);
      await rename(target, rotated);
    }
    await appendFile(target, `${JSON.stringify(safe)}\n`, { encoding: 'utf8', mode: 0o600 });
  });
  return pending;
}

function finite(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
