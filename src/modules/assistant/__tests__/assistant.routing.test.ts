import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatEvent, Conversation, ToolResult } from '../assistant.types';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), execute: vi.fn(), save: vi.fn(), get: vi.fn() }));
vi.mock('../assistant.ollama', () => ({ generateLocal: mocks.generate, modelStatus: vi.fn() }));
vi.mock('../assistant.tools', () => ({ executeAssistantTool: mocks.execute, assistantTools: [] }));
vi.mock('../assistant.storage', () => ({
  assistantDataRoot: () => '', deleteConversation: vi.fn(), listConversations: vi.fn(),
  getConversation: mocks.get, saveConversation: mocks.save,
  newConversation: (title: string) => ({ id: 'fixture-conversation', title, updatedAt: '', turns: [], messages: [] }),
}));
vi.mock('../assistant.metrics', () => ({ appendAssistantRequestMetric: vi.fn().mockResolvedValue(undefined) }));
import { converse } from '../assistant.service';

describe('assistant grounded lookup pipeline', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns grouping results and preserves followups with zero model calls', async () => {
    const result = { summary: 'One possible DOM group across 5 orders; lengths need review.', total: 1, offset: 0, rows: [], sources: [], procurement: { groups: [], eligibleParts: 27, eligibleOrders: 21, unreviewedParts: 94, ungrouped: [], timings: { queryMs: 1, groupingMs: 1 } } } satisfies ToolResult;
    mocks.execute.mockResolvedValue(result);
    const events: ChatEvent[] = [];
    await converse('test-user', { message: 'Are there any orders with similar stock dimensions that need ordering? That way I combine my orders from Alro' }, new AbortController().signal, e => events.push(e));
    expect(mocks.execute).toHaveBeenCalledWith('find_procurement_groups', {});
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(events.some(e => e.type === 'done')).toBe(true);
    const saved = mocks.save.mock.calls[0][1] as Conversation;
    expect(saved.lookup).toEqual({ name: 'find_procurement_groups', args: {} });
    mocks.get.mockResolvedValue(saved);
    await converse('test-user', { message: 'Only the overdue ones.', conversationId: saved.id }, new AbortController().signal, () => {});
    expect(mocks.execute).toHaveBeenLastCalledWith('find_procurement_groups', { overdue: true });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('keeps normal conversation and compacts legacy record payloads before the model', async () => {
    const raw = { summary: '27 parts', total: 27, offset: 0, rows: Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, partNumber: `part${i}`, notes: 'LONG_PRIVATE_NOTES'.repeat(50) })), sources: [] };
    mocks.get.mockResolvedValue({ id: 'fixture-conversation', title: 'Purchases', updatedAt: '', turns: [], messages: [
      { role: 'user', content: 'Which parts?' }, { role: 'assistant', content: '', tool_calls: [{ function: { name: 'search_shop', arguments: { mode: 'procurement' } } }] }, { role: 'tool', tool_name: 'search_shop', content: JSON.stringify(raw) }, { role: 'assistant', content: '27 parts.' },
    ] });
    mocks.generate.mockResolvedValue({ role: 'assistant', content: 'Sure. What would you like to prioritize today?' });
    await converse('test-user', { message: 'Can we talk about organizing my workday?', conversationId: 'fixture-conversation' }, new AbortController().signal, () => {});
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mocks.generate.mock.calls[0][0])).not.toContain('LONG_PRIVATE_NOTES');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
