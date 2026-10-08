'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, Plus, Square, FileSearch, MessageSquare, Trash2, RefreshCw } from 'lucide-react';
import type { ChatEvent, Conversation, Source, ToolResult, Turn } from './assistant.types';
import { ProcurementResults } from './procurement-results.ui';

type Status = { ready: boolean; model: string; conversations: { id: string; title: string; updatedAt: string }[]; index: { updatedAt?: string; status: string; processed: number; total: number; states: Record<string, number> } };
const prompts = ['Are there any orders with similar stock dimensions that need ordering? That way I combine my orders from Alro', 'Find the 4140 parts that were hardened.', 'How many customers have quotes that haven’t converted to orders?', 'Find the drawings for part number pj1407.'];

export default function AssistantChat() {
  const [status, setStatus] = useState<Status | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    try { const response = await fetch('/api/admin/assistant', { cache: 'no-store' }); if (!response.ok) throw new Error('Could not load assistant status.'); setStatus(await response.json()); }
    catch { setError('Could not load the assistant. Check your connection and admin session.'); }
  }, []);
  useEffect(() => { void refresh(); return () => abort.current?.abort(); }, [refresh]);
  useEffect(() => { if (!busy) return; setElapsed(0); const timer = setInterval(() => setElapsed(n => n + 1), 1000); return () => clearInterval(timer); }, [busy]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [reply, results, conversation]);
  useEffect(() => { if (status?.index.status !== 'indexing') return; const timer = setInterval(() => void refresh(), 10000); return () => clearInterval(timer); }, [status?.index.status, refresh]);

  async function openChat(id: string) {
    if (busy) return;
    setError('');
    try { const response = await fetch(`/api/admin/assistant?id=${encodeURIComponent(id)}`); if (!response.ok) throw new Error(); setConversation(await response.json()); setPendingQuestion(''); setReply(''); setResults([]); }
    catch { setError('This conversation could not be opened.'); }
  }
  async function send(message = draft) {
    if (busy || !message.trim()) return;
    const question = message.trim();
    setBusy(true); setError(''); setDraft(''); setReply(''); setResults([]); setPendingQuestion(question); setProgress('Connecting to the local assistant…');
    const controller = new AbortController(); abort.current = controller;
    let completed = false;
    try {
      const response = await fetch('/api/admin/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ message: question, ...(conversation && { conversationId: conversation.id }) }) });
      if (!response.ok || !response.body) throw new Error((await response.json()).error || 'Assistant unavailable.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines.filter(Boolean)) {
          const event: ChatEvent = JSON.parse(line);
          if (event.type === 'status') setProgress(event.message);
          if (event.type === 'text') setReply(text => text + event.text);
          if (event.type === 'result') setResults(items => [...items, event.result]);
          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'done') { completed = true; setConversation(event.conversation); setPendingQuestion(''); setReply(''); setResults([]); }
        }
        if (chunk.done) break;
      }
      if (!completed) throw new Error('The connection ended before the reply was saved. Please retry.');
      await refresh();
    } catch (e) { setError(controller.signal.aborted ? 'Reply stopped. This unfinished exchange was not saved.' : e instanceof Error ? e.message : 'Could not finish the reply.'); setDraft(question); }
    finally { setBusy(false); abort.current = null; }
  }
  async function removeChat() {
    if (!conversation || busy) return;
    const response = await fetch(`/api/admin/assistant?id=${conversation.id}`, { method: 'DELETE' });
    if (response.ok) { setConversation(null); setPendingQuestion(''); setReply(''); setResults([]); void refresh(); }
    else setError('Could not delete this conversation.');
  }
  async function reindex() {
    setError('');
    const response = await fetch('/api/admin/assistant?action=index', { method: 'POST' }).catch(() => null);
    if (!response?.ok) setError('The document indexer could not start.');
    else { setStatus(s => s ? { ...s, index: { ...s.index, status: 'indexing' } } : s); }
  }
  return <div className="mx-auto max-w-7xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Bot className="h-7 w-7 text-primary" />Shop Assistant</h1><p className="mt-1 text-sm text-muted-foreground">Talk through your work. Find the records and drawings behind it.</p></div>
      <span className={`rounded-full border px-3 py-1 text-xs ${status?.ready ? 'border-green-500/40 text-green-400' : 'border-border text-muted-foreground'}`}>{status?.ready ? 'Local AI ready' : status ? 'Local AI offline' : 'Checking local AI…'}</span>
    </header>
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <button disabled={busy} onClick={() => { setConversation(null); setPendingQuestion(''); setReply(''); setResults([]); setError(''); setDraft(''); }} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:border-primary disabled:opacity-50"><Plus className="h-4 w-4" />New conversation</button>
        <nav aria-label="Saved conversations" className="flex max-h-36 flex-col gap-1 overflow-y-auto lg:max-h-[400px]">{status?.conversations.map(c => <button key={c.id} disabled={busy} onClick={() => void openChat(c.id)} className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${conversation?.id === c.id ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><MessageSquare className="mr-2 inline h-3 w-3" />{c.title}</button>)}</nav>
        <details className="rounded-lg border border-border p-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Local files & privacy</summary><div className="mt-3 space-y-3"><p>Conversations and document text stay on this PC. Saved chats are private to your admin account. The assistant reads shop records; it cannot edit them.</p><p>PDF text and image OCR are searchable. ASCII DXF and STEP/IGES labels are supported. Native DWG and other binary CAD files can be found by their names and linked parts; geometry is not interpreted.</p><p>{status?.index.total || 0} files · {status?.index.status || 'Checking'}{status?.index.status === 'indexing' ? ` (${status.index.processed}/${status.index.total})` : ''}</p>{status?.index.updatedAt && <p>Last scan: {new Date(status.index.updatedAt).toLocaleString()}</p>}{status && <p>{Object.entries(status.index.states).map(([name, n]) => `${n} ${name}`).join(' · ')}</p>}<button onClick={() => void reindex()} disabled={status?.index.status === 'indexing'} className="flex min-h-9 items-center gap-2 text-foreground disabled:opacity-50"><RefreshCw className="h-3 w-3" />Refresh document index</button><p>{status?.model} · CPU inference may take a minute or more for detailed questions.</p></div></details>
      </aside>
      <section className="flex min-h-[65vh] min-w-0 flex-col rounded-xl border border-border bg-card/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="truncate text-sm font-medium">{conversation?.title || 'A conversation about your shop'}</h2>{conversation && <button onClick={() => void removeChat()} disabled={busy} aria-label="Delete this conversation" title="Delete this conversation" className="ml-2 rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}</div>
        <div className="max-h-[65vh] flex-1 space-y-6 overflow-y-auto p-4 sm:p-6" role="log" aria-label="Conversation">
          {!conversation && !pendingQuestion && <div className="mx-auto max-w-2xl space-y-5 py-6"><h3 className="text-xl font-medium">What are you working on?</h3><p className="text-sm text-muted-foreground">Ask a question, search old work, or talk through a plan. You can follow up with “only the overdue ones” or “tell me more about the second one.”</p><div className="grid gap-2 sm:grid-cols-2">{prompts.map(prompt => <button key={prompt} onClick={() => void send(prompt)} disabled={busy} className="rounded-lg border border-border bg-background/50 p-3 text-left text-sm hover:border-primary disabled:opacity-50">{prompt}</button>)}</div></div>}
          {conversation?.turns.map((turn, i) => <Bubble key={`${conversation.id}-${i}`} turn={turn} />)}
          {pendingQuestion && <Bubble turn={{ role: 'user', content: pendingQuestion }} />}
          {(reply || results.length > 0) && <Bubble turn={{ role: 'assistant', content: reply, results, sources: results.flatMap(r => r.sources) }} />}
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />{progress} <span className="tabular-nums">{elapsed}s</span></p>}
          <div ref={end} />
        </div>
        <form onSubmit={e => { e.preventDefault(); void send(); }} className="space-y-2 border-t border-border p-4">
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {status && !status.ready && <p className="text-sm text-muted-foreground">The conversational model is offline. Shop lookups such as purchasing groups can still run. <button type="button" onClick={() => void refresh()} className="underline">Check again</button></p>}
          <div className="flex items-end gap-2"><textarea aria-label="Message Shop Assistant" value={draft} onChange={e => setDraft(e.target.value)} maxLength={6000} rows={2} placeholder="Ask about your shop, find a drawing, or just talk…" className="min-h-14 min-w-0 flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />{busy ? <button type="button" onClick={() => abort.current?.abort()} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm"><Square className="h-4 w-4" />Stop</button> : <button disabled={!draft.trim()} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" />Send</button>}</div>
          <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line · Check the linked originals before acting on manufacturing details.</p>
        </form>
      </section>
    </div>
  </div>;
}

function Bubble({ turn }: { turn: Turn }) {
  const user = turn.role === 'user';
  const sources = new Map((turn.sources || []).map(s => [s.id, s]));
  return <article className={user ? 'ml-auto max-w-[90%] rounded-xl bg-primary/10 p-4 sm:max-w-[80%]' : 'space-y-3'}><p className="mb-1 text-xs font-semibold text-muted-foreground">{user ? 'You' : 'Shop Assistant'}</p><div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{user ? turn.content : <FormattedText text={turn.content} />}</div>{turn.results?.map((result, i) => result.procurement ? <ProcurementResults key={i} report={result.procurement} /> : <details key={i} open={result.rows.length <= 5} className="rounded-lg border border-border bg-background/40 p-3"><summary className="cursor-pointer text-sm font-medium"><FileSearch className="mr-2 inline h-4 w-4 text-primary" />{result.summary}</summary><div className="mt-3 space-y-2">{result.rows.map((row, j) => { const source = result.sources.find(s => s.id === row.id) || result.sources[j]; return <div key={j} className="rounded-md border border-border/60 p-2 text-xs">{source && <SourceLink source={source} />}<dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">{Object.entries(row).filter(([k, v]) => k !== 'id' && v !== null && v !== undefined && v !== '').map(([key, value]) => <div key={key} className={key === 'text' || key === 'snippet' || key === 'notes' ? 'w-full whitespace-pre-wrap break-words' : 'break-words'}><dt className="inline font-medium">{key.replace(/([A-Z])/g, ' $1')}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl></div>; })}</div></details>)}{!turn.results?.length && [...sources.values()].map(source => <SourceLink key={source.id} source={source} />)}</article>;
}
function FormattedText({ text }: { text: string }) {
  return <>{text.replace(/^\s*\*\s+/gm, '• ').split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((piece, i) => piece.startsWith('**') ? <strong key={i}>{piece.slice(2, -2)}</strong> : piece.startsWith('`') ? <code key={i} className="rounded bg-muted px-1">{piece.slice(1, -1)}</code> : piece)}</>;
}
function SourceLink({ source }: { source: Source }) {
  // URLs originate from server-owned record IDs/storage paths; never render model-authored URLs or HTML.
  if (!/^\/(orders|customers|admin\/quotes|attachments)\//.test(source.href) || source.href.startsWith('//')) return <span>{source.label}</span>;
  return <a href={source.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{source.label}</a>;
}
