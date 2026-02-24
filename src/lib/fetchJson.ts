import { emitAuthRequired } from '@/lib/auth-required';

export async function fetchJson<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch {}

    if (res.status === 401 || res.status === 403 || body?.code === 'AUTH_REQUIRED') {
      emitAuthRequired({ url: typeof input === 'string' ? input : undefined });
    }

    const err: any = new Error('Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}
