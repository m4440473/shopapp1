import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { authRequiredResponse, forbiddenResponse } from '@/lib/auth-api';
import { chatRequestSchema } from '@/modules/assistant/assistant.schema';
import { assistantStatus, converse, deleteConversation, getConversation, listConversations, refreshDocumentIndex } from '@/modules/assistant/assistant.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authorize() {
  const session = await getServerAuthSession();
  if (!session?.user) return { response: authRequiredResponse() };
  if (!canAccessAdmin(session.user as { role?: string; admin?: boolean })) return { response: forbiddenResponse() };
  return { userId: String((session.user as { id: string }).id) };
}
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return !origin || new URL(origin).host === req.headers.get('host');
}
export async function GET(req: NextRequest) {
  const auth = await authorize(); if (auth.response) return auth.response;
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    try { const c = await getConversation(auth.userId!, id); return NextResponse.json({ ...c, messages: [] }, { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }); }
  }
  return NextResponse.json({ ...(await assistantStatus()), conversations: await listConversations(auth.userId!) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  const auth = await authorize(); if (auth.response) return auth.response;
  if (!sameOrigin(req)) return forbiddenResponse();
  if (Number(req.headers.get('content-length') || 0) > 16000) return NextResponse.json({ error: 'Message too long.' }, { status: 413 });
  if (req.nextUrl.searchParams.get('action') === 'index') {
    try { await refreshDocumentIndex(); return NextResponse.json({ ok: true }); }
    catch { return NextResponse.json({ error: 'Document indexer is unavailable.' }, { status: 503 }); }
  }
  let body;
  try { const raw = await req.text(); if (raw.length > 16000) throw new Error(); body = chatRequestSchema.parse(JSON.parse(raw)); }
  catch { return NextResponse.json({ error: 'Enter a message of 1–6000 characters.' }, { status: 400 }); }
  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(output) {
      const send = (event: unknown) => { if (!controller.signal.aborted) output.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      try { await converse(auth.userId!, body, controller.signal, send); }
      catch (error) { send({ type: 'error', message: controller.signal.aborted ? 'Reply stopped.' : error instanceof Error && /Conversation not found|already running|busy|did not return|too many/.test(error.message) ? error.message : 'The local assistant could not finish. Check its status and try again. Your shop records have not changed.' }); }
      finally { try { output.close(); } catch { /* Client disconnected. */ } }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
export async function DELETE(req: NextRequest) {
  const auth = await authorize(); if (auth.response) return auth.response;
  if (!sameOrigin(req)) return forbiddenResponse();
  try { await deleteConversation(auth.userId!, req.nextUrl.searchParams.get('id') || ''); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }); }
}
