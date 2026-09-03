import 'server-only';
import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { PhoneUploadError } from './phone-upload.types';

export const privateHeaders = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
let activePhotoRequests = 0;
export async function boundedPhotoRequest<T>(action: () => Promise<T>) {
  if (activePhotoRequests >= 4) throw new PhoneUploadError('Uploads are busy. Please retry shortly.', 429);
  activePhotoRequests++;
  try { return await action(); } finally { activePhotoRequests--; }
}
export async function phoneAdmin() {
  const session = await getServerAuthSession();
  const user = session?.user as { id?: string; role?: string; admin?: boolean } | undefined;
  if (!user?.id) throw new PhoneUploadError('Sign in first.', 401);
  if (!canAccessAdmin(user)) throw new PhoneUploadError('Admin access required.', 403);
  return user.id;
}
export async function boundedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new PhoneUploadError('Upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PhoneUploadError('Empty request.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new PhoneUploadError('Upload is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function smallJson(request: Request) {
  try { return JSON.parse((await boundedBody(request, 8192)).toString('utf8')); }
  catch (error) { if (error instanceof PhoneUploadError) throw error; throw new PhoneUploadError('Invalid request.'); }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Next's request URL can contain the internal bind address (0.0.0.0).
  // Host is the browser-addressed authority; browsers cannot spoof it in fetch.
  const internal = new URL(request.url);
  const host = request.headers.get('host');
  const forwardedProtocol = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProtocol === 'http' || forwardedProtocol === 'https' ? forwardedProtocol + ':' : internal.protocol;
  if (host && /[\s/@?#]/.test(host)) throw new PhoneUploadError('Cross-site upload requests are not allowed.', 403);
  const external = new URL(`${protocol}//${host || internal.host}`);
  if (origin && origin !== external.origin) throw new PhoneUploadError('Cross-site upload requests are not allowed.', 403);
}
export async function phoneResponse(action: () => Promise<unknown>) {
  try { return NextResponse.json(await action(), { headers: privateHeaders }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof PhoneUploadError ? error.message : 'Upload could not finish. Retry, or ask for a new link.' }, { status: error instanceof PhoneUploadError ? error.status : 500, headers: privateHeaders });
  }
}
