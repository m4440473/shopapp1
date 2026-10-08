import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { attachmentHref, searchSnippet } from '../assistant.documents';
import { chatRequestSchema, searchSchema } from '../assistant.schema';
import { orderPartWhere, quoteWhere } from '../assistant.repo';
import { ollamaUrl, generateLocal, localNumThreads } from '../assistant.ollama';
import { appendAssistantRequestMetric } from '../assistant.metrics';
import { getConversation, listConversations, newConversation, saveConversation } from '../assistant.storage';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('read-only assistant boundaries', () => {
  it('rejects SQL, arbitrary paths and excessive requests', () => {
    expect(searchSchema.safeParse({ mode: 'orders', sql: 'DELETE FROM Order' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: 'x'.repeat(6001) }).success).toBe(false);
    expect(searchSchema.safeParse({ mode: 'files', offset: -1 }).success).toBe(false);
    expect(attachmentHref('../config/.env')).toBe(null);
    expect(attachmentHref('C:\\ShopApp\\config\\.env')).toBe(null);
    expect(attachmentHref('/etc/passwd')).toBe(null);
    expect(attachmentHref('customer/a drawing.pdf')).toBe('/attachments/customer/a%20drawing.pdf');
  });
  it('never permits remote model endpoints', () => {
    vi.stubEnv('SHOPAPP_OLLAMA_URL', 'https://api.example.com');
    expect(() => ollamaUrl()).toThrow('local');
    vi.stubEnv('SHOPAPP_OLLAMA_URL', 'http://127.0.0.1:11434');
    expect(ollamaUrl()).toBe('http://127.0.0.1:11434');
  });
  it('bounds the configurable local thread count', () => {
    expect(localNumThreads()).toBe(3);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', '0'); expect(localNumThreads()).toBe(1);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', '24'); expect(localNumThreads()).toBe(8);
    vi.stubEnv('SHOPAPP_ASSISTANT_NUM_THREAD', 'invalid'); expect(localNumThreads()).toBe(3);
  });
  it('uses part material state and excludes completed orders/parts for procurement', () => {
    const where = orderPartWhere(searchSchema.parse({ mode: 'procurement', overdue: true }));
    expect(where.materialStatus).toBe('NEED_TO_ORDER');
    expect(where.status).toEqual({ notIn: expect.arrayContaining(['COMPLETE', 'CLOSED']) });
    expect(where.order).toMatchObject({ status: { notIn: expect.arrayContaining(['COMPLETE']) }, dueDate: { lt: expect.any(Date) } });
  });
  it('historical search has no implicit active or date filter', () => {
    const where = orderPartWhere(searchSchema.parse({ mode: 'orders', material: '4140', finish: 'harden' }));
    expect(where.order).toEqual({});
    expect(where.status).toBeUndefined();
    expect(where.AND).toHaveLength(2);
  });
  it('distinguishes unconverted quotes from customers who never ordered', () => {
    const unconverted = quoteWhere(searchSchema.parse({ mode: 'quotes', conversion: 'unconverted' }));
    expect(unconverted.convertedOrder).toEqual({ is: null });
    expect(unconverted.customer).toBeUndefined();
    expect(unconverted.status).toBeUndefined();
    const never = quoteWhere(searchSchema.parse({ mode: 'quotes', conversion: 'never_ordered' }));
    expect(never.customer).toEqual({ is: { orders: { none: {} } } });
  });
  it('snippets include a match deep inside a drawing', () => {
    expect(searchSnippet('x'.repeat(3000) + 'PJ1407 hardened 4140', ['pj1407'])).toContain('PJ1407 hardened 4140');
  });
  it('isolates saved histories by authenticated user ID', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'shop-assistant-test-'));
    vi.stubEnv('SHOPAPP_ASSISTANT_DATA_DIR', root);
    try {
      const c = newConversation('Find my drawings'); c.turns.push({ role: 'user', content: 'Find PJ1407' });
      await saveConversation('admin-a', c);
      expect((await getConversation('admin-a', c.id)).turns).toHaveLength(1);
      await expect(getConversation('admin-b', c.id)).rejects.toThrow('not found');
      expect(await listConversations('admin-b')).toEqual([]);
      await expect(getConversation('admin-a', '../../config/.env')).rejects.toThrow('not found');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('parses split NDJSON tokens and tool calls without losing history', async () => {
    const chunks = ['{"message":{"content":"Hel', 'lo"}}\n{"message":{"tool_calls":[{"function":{"name":"search_shop","arguments":{"mode":"orders"}}}]},"done":true,"prompt_eval_count":12,"eval_count":5,"load_duration":100,"prompt_eval_duration":200,"eval_duration":300,"total_duration":600}\n'];
    const request = vi.fn(async (_url: string, _options: RequestInit) => new Response(new ReadableStream({ start(c) { for (const text of chunks) c.enqueue(new TextEncoder().encode(text)); c.close(); } })));
    vi.stubGlobal('fetch', request);
    const onMetrics = vi.fn();
    const result = await generateLocal([{ role: 'user', content: 'Find PJ1407' }], [], new AbortController().signal, undefined, onMetrics);
    expect(result.content).toBe('Hello');
    expect(result.tool_calls?.[0].function.arguments).toEqual({ mode: 'orders' });
    const body = JSON.parse(request.mock.calls[0][1].body as string);
    expect(body.think).toBe(false); expect(body.messages[0].content).toBe('Find PJ1407');
    expect(body.options.num_thread).toBe(3);
    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ wallMs: expect.any(Number), promptEvalCount: 12, evalCount: 5, loadDurationNs: 100, promptEvalDurationNs: 200, evalDurationNs: 300, totalDurationNs: 600 }));
  });
  it('appends privacy-preserving request metrics without accepting request content', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'shop-assistant-metrics-'));
    vi.stubEnv('SHOPAPP_ASSISTANT_DATA_DIR', root);
    try {
      await appendAssistantRequestMetric({ outcome: 'success', route: 'model', totalMs: 42, modelCalls: [{ wallMs: 40, promptEvalCount: 7, evalCount: 3, totalDurationNs: 1000 }], tools: [{ name: 'search_shop', wallMs: 2, queryMs: 1, payloadBytes: 80, groupResultCount: 2 }] });
      const line = await import('node:fs/promises').then(fs => fs.readFile(path.join(root, 'metrics', 'requests.jsonl'), 'utf8'));
      const saved = JSON.parse(line);
      expect(saved).toMatchObject({ outcome: 'success', route: 'model', totalMs: 42, modelCalls: [{ wallMs: 40, promptEvalCount: 7, evalCount: 3, totalDurationNs: 1000 }], tools: [{ name: 'search_shop', wallMs: 2, queryMs: 1, payloadBytes: 80, groupResultCount: 2 }] });
      expect(saved).not.toHaveProperty('prompt'); expect(saved).not.toHaveProperty('result'); expect(saved).not.toHaveProperty('userId');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
