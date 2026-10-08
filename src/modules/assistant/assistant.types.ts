import type { ProcurementReport } from '../procurement/procurement.types';
export type Source = { id: string; label: string; href: string; detail?: string };
export type ToolResult = { summary: string; total: number; offset: number; rows: Record<string, unknown>[]; sources: Source[]; procurement?: ProcurementReport };
export type LookupContext = { name: 'search_shop' | 'find_procurement_groups'; args: Record<string, unknown> };
export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_name?: string };
export type ToolCall = { function: { name: string; arguments: Record<string, unknown> } };
export type Turn = { role: 'user' | 'assistant'; content: string; sources?: Source[]; results?: ToolResult[] };
export type Conversation = { id: string; title: string; updatedAt: string; messages: ChatMessage[]; turns: Turn[]; lookup?: LookupContext };
export type ChatEvent = { type: 'status'; message: string } | { type: 'text'; text: string } | { type: 'result'; result: ToolResult } | { type: 'done'; conversation: Conversation } | { type: 'error'; message: string };
