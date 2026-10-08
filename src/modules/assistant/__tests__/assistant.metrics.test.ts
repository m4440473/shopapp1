import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendAssistantRequestMetric } from '../assistant.metrics';
import { generateLocal, localNumThreads } from '../assistant.ollama';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('assistant local metrics', () => {
  it('captures terminal Ollama counts and durations from split NDJSON', async () => {
    const chunks = [
      '{"message":{"content":"Pur',
      'chase summary"}}\n{"done":true,"prompt_eval_count":12,"eval_count":5,"load_duration":100,"prompt_eval_duration":200,"eval_duration":300,"total_duration":600}\n',
    ];
    const request = vi.fn(async () => new Response(new ReadableStream({ start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    } })));
    vi.stubGlobal('fetch', request);
    const onMetrics = vi.fn();

    const result = await generateLocal([{ role: 'user', content: 'Synthetic request' }], [], new AbortController().signal, undefined, onMetrics);

    expect(result.content).toBe('Purchase summary');
    expect(onMetrics).toHaveBeenCalledOnce();
    expect(onMetrics).toHaveBeenCalledWith({ wallMs: expect.any(Number), promptEvalCount: 12, evalCount: 5, loadDurationNs: 100, promptEvalDurationNs: 200, evalDurationNs: 300, totalDurationNs: 600 });
  });

  it('uses a safe thread default and clamps configured values to 1..8', async () => {
    expect(localNumThreads()).toBe(3);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', '0'); expect(localNumThreads()).toBe(1);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', '24'); expect(localNumThreads()).toBe(8);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', 'invalid'); expect(localNumThreads()).toBe(3);
  });

  it('writes only operational fields and rotates a full JSONL file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'shop-assistant-metrics-'));
    vi.stubEnv('SHOPAPP_ASSISTANT_DATA_DIR', root);
    const directory = path.join(root, 'metrics');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'requests.jsonl'), Buffer.alloc(5 * 1024 * 1024, 32));
    try {
      await appendAssistantRequestMetric({
        outcome: 'success', route: 'model', totalMs: 42, toolRounds: 1,
        modelCalls: [{ wallMs: 40, promptEvalCount: 7, evalCount: 3, totalDurationNs: 1000 }],
        tools: [{ name: 'search_shop', outcome: 'success', wallMs: 2, queryMs: 1, payloadBytes: 80, groupResultCount: 2 }],
      });
      const saved = JSON.parse(await readFile(path.join(directory, 'requests.jsonl'), 'utf8'));
      expect(saved).toMatchObject({ outcome: 'success', route: 'model', totalMs: 42, modelCalls: [{ promptEvalCount: 7, evalCount: 3 }], tools: [{ name: 'search_shop', outcome: 'success', payloadBytes: 80 }] });
      expect(saved).not.toHaveProperty('prompt'); expect(saved).not.toHaveProperty('result');
      expect(saved).not.toHaveProperty('conversationId'); expect(saved).not.toHaveProperty('userId');
      expect((await stat(path.join(directory, 'requests.1.jsonl'))).size).toBe(5 * 1024 * 1024);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
