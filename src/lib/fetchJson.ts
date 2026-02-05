export async function fetchJson<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch {}
    const err: any = new Error('Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}
