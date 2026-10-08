import 'server-only';
import type { ChatMessage, ToolCall } from './assistant.types';

export type OllamaGenerationMetrics = {
  wallMs: number;
  promptEvalCount?: number;
  evalCount?: number;
  loadDurationNs?: number;
  promptEvalDurationNs?: number;
  evalDurationNs?: number;
  totalDurationNs?: number;
};

export const localModel = () => process.env.SHOPAPP_ASSISTANT_MODEL || 'qwen3.5:4b';
export function localNumThreads() {
  const configured = Number.parseInt(process.env.SHOPAPP_ASSISTANT_NUM_THREAD || '', 10);
  return Number.isFinite(configured) ? Math.min(8, Math.max(1, configured)) : 3;
}
export function ollamaUrl() {
  const url = new URL(process.env.SHOPAPP_OLLAMA_URL || 'http://127.0.0.1:11434');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Assistant requires a local Ollama address.');
  return url.origin;
}
export async function modelStatus() {
  try {
    const response = await fetch(`${ollamaUrl()}/api/tags`, { signal: AbortSignal.timeout(3000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    return { ready: data.models?.some((m: { name: string }) => m.name === localModel()) === true, model: localModel() };
  } catch { return { ready: false, model: localModel() }; }
}

export async function generateLocal(messages: ChatMessage[], tools: unknown[] | undefined, signal: AbortSignal, onText?: (text: string) => void, onMetrics?: (metrics: OllamaGenerationMetrics) => void) {
  const startedAt = performance.now();
  const timeout = AbortSignal.timeout(240000);
  const response = await fetch(`${ollamaUrl()}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, timeout]), redirect: 'error',
    body: JSON.stringify({ model: localModel(), messages, tools, stream: true, think: false, keep_alive: '30m',
      options: { temperature: 0.2, num_ctx: 8192, num_predict: 900, num_thread: localNumThreads() } }),
  });
  if (!response.ok || !response.body) throw new Error(response.status === 404 ? 'The local model is not installed.' : 'The local model is unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder(); let buffer = ''; let content = ''; const calls: ToolCall[] = []; let done = false; let finalEvent: Record<string, unknown> | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      if (chunk.done && buffer.trim()) { lines.push(buffer); buffer = ''; }
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.error) throw new Error('Local generation failed.');
        if (event.message?.content) { content += event.message.content; onText?.(event.message.content); }
        if (event.message?.tool_calls) calls.push(...event.message.tool_calls);
        if (event.done) { done = true; finalEvent = event; if (event.done_reason === 'length') content += '\n\n[Response reached its length limit. Ask me to continue.]'; }
      }
      if (chunk.done) break;
    }
  } finally { reader.releaseLock(); }
  if (!done) throw new Error('Local model connection ended before the response finished.');
  const number = (key: string) => typeof finalEvent?.[key] === 'number' ? finalEvent[key] as number : undefined;
  onMetrics?.({
    wallMs: Math.round(performance.now() - startedAt),
    promptEvalCount: number('prompt_eval_count'), evalCount: number('eval_count'),
    loadDurationNs: number('load_duration'), promptEvalDurationNs: number('prompt_eval_duration'),
    evalDurationNs: number('eval_duration'), totalDurationNs: number('total_duration'),
  });
  return { role: 'assistant' as const, content, ...(calls.length && { tool_calls: calls }) };
}
