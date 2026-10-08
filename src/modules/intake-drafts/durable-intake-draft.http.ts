import 'server-only';
import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { clearDurableIntakeDraft, getDurableIntakeDraft, saveDurableIntakeDraft } from './durable-intake-draft.service';
import { DurableIntakeDraftError, INTAKE_DRAFT_MAX_BYTES } from './durable-intake-draft.types';

const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
type Context = { params: Promise<{ kind: string; key: string }> };
async function owner() {
  const session = await getServerAuthSession();
  const user = session?.user as { id?: string; role?: string; admin?: boolean } | undefined;
  if (!user?.id) throw new DurableIntakeDraftError('Sign in to save your draft. Your changes are still in this browser.', 401);
  if (!canAccessAdmin(user)) throw new DurableIntakeDraftError('You do not have permission to save this draft.', 403);
  return user.id;
}
async function mutationOwner(request: Request) {
  const userId = await owner();
  if (request.headers.get('x-shopapp-draft-owner') !== userId) throw new DurableIntakeDraftError('Your signed-in account changed. Reload before saving; your changes are still in this browser.', 403);
  return userId;
}
function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  const forwarded = request.headers.get('x-forwarded-proto');
  const protocol = forwarded === 'http' || forwarded === 'https' ? `${forwarded}:` : url.protocol;
  if (/[\s/@?#]/.test(host)) throw new DurableIntakeDraftError('Cross-site draft changes are not allowed.', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(`${protocol}//${host}`).origin) throw new DurableIntakeDraftError('Cross-site draft changes are not allowed.', 403);
}
async function body(request: Request) {
  const maximum = INTAKE_DRAFT_MAX_BYTES + 4096;
  if (Number(request.headers.get('content-length') || 0) > maximum) throw new DurableIntakeDraftError('This draft is too large to save.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DurableIntakeDraftError('Missing draft data.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new DurableIntakeDraftError('This draft is too large to save.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new DurableIntakeDraftError('Invalid draft data.'); }
}
async function response(action: () => Promise<unknown>) {
  try { return NextResponse.json(await action(), { headers }); }
  catch (error) {
    const known = error instanceof DurableIntakeDraftError;
    return NextResponse.json({ error: known ? error.message : 'The draft could not be saved. Your changes are still in this browser.',
      ...(known && error.current ? { current: error.current } : {}) }, { status: known ? error.status : 500, headers });
  }
}
export function getIntakeDraft(_request: Request, context: Context) {
  return response(async () => { const userId = await owner(); const { kind, key } = await context.params; return getDurableIntakeDraft(userId, kind, key); });
}
export function putIntakeDraft(request: Request, context: Context) {
  return response(async () => { const userId = await mutationOwner(request); sameOrigin(request); const { kind, key } = await context.params; return saveDurableIntakeDraft(userId, kind, key, await body(request)); });
}
export function deleteIntakeDraft(request: Request, context: Context) {
  return response(async () => { const userId = await mutationOwner(request); sameOrigin(request); const { kind, key } = await context.params; return clearDurableIntakeDraft(userId, kind, key, await body(request)); });
}
