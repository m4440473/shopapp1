'use client';
import * as React from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PhoneUploadContext, PhoneUploadStatus } from '@/modules/phone-upload/phone-upload.types';
import type { DrawingImportJobSnapshot } from './drawing-import-ui.types';
type Session = PhoneUploadStatus & { url?: string; relativeUrl?: string; qrDataUrl?: string; context?: PhoneUploadContext };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Phone upload request failed.');
  return data;
}
export function PhoneUploadHandoff({ context, enabled, onJob, onActiveChange, onRestoreContext }: {
  context: PhoneUploadContext; enabled: boolean; onJob: (job: DrawingImportJobSnapshot) => void;
  onActiveChange: (active: boolean) => void; onRestoreContext: (context: PhoneUploadContext) => void;
}) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [restored, setRestored] = React.useState(false);
  const callbacks = React.useRef({ onJob, onRestoreContext, context });
  callbacks.current = { onJob, onRestoreContext, context };
  const key = `shopapp:phone-upload:${JSON.stringify([context.destination, context.business, context.customerName, context.draftReference])}`;
  React.useEffect(() => {
    let active = true;
    setRestored(false); setSession(null); setError('');
    let id: string | null = null;
    try { id = localStorage.getItem(key); } catch { /* optional recovery */ }
    if (!id) { setRestored(true); return; }
    void request<Session>(`/api/admin/phone-upload/${id}`).then(data => {
      if (!active) return;
      if (data.status === 'REVOKED') { localStorage.removeItem(key); return; }
      setSession(data);
      if (data.context) callbacks.current.onRestoreContext(data.context);
    }).catch(() => { if (active) localStorage.removeItem(key); }).finally(() => { if (active) setRestored(true); });
    return () => { active = false; };
  }, [key]);
  const sessionId = session?.id;
  React.useEffect(() => { onActiveChange(Boolean(sessionId)); return () => onActiveChange(false); }, [sessionId, onActiveChange]);
  React.useEffect(() => {
    if (!sessionId || !restored) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<Session>(`/api/admin/phone-upload/${sessionId}`);
        if (!active) return;
        setSession(previous => ({ ...previous, ...next }));
        if (next.status === 'READY' || next.status === 'IMPORTED') {
          const job = await request<DrawingImportJobSnapshot>(`/api/admin/phone-upload/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(callbacks.current.context) });
          if (!active) return;
          callbacks.current.onJob(job);
          localStorage.removeItem(key);
          return;
        }
        if (next.status === 'REVOKED' || next.expiresAt < Date.now()) { setError('This phone link has closed or expired. Close it and create a new one.'); return; }
        setError('');
      } catch (problem) { if (active) setError(problem instanceof Error ? problem.message : 'Could not check phone upload. Retrying…'); }
      if (active) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [sessionId, key, restored]);
  async function create() {
    setBusy(true); setError('');
    try {
      const next = await request<Session>('/api/admin/phone-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context) });
      setSession(next);
      try { localStorage.setItem(key, next.id); } catch { setError('Keep this page open: browser recovery storage is unavailable.'); }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not create phone link.'); }
    finally { setBusy(false); }
  }
  async function close() {
    if (!session) return;
    setBusy(true);
    try { await request(`/api/admin/phone-upload/${session.id}`, { method: 'DELETE' }); localStorage.removeItem(key); setSession(null); setError(''); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not close link.'); }
    finally { setBusy(false); }
  }
  async function importReceivedPhotos() {
    if (!session) return;
    setBusy(true); setError('');
    try {
      await request(`/api/admin/phone-upload/${session.id}`, { method: 'PATCH' });
      const job = await request<DrawingImportJobSnapshot>(`/api/admin/phone-upload/${session.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context) });
      onJob(job); localStorage.removeItem(key);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not import received photos.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    {!session ? <Button type="button" variant="outline" disabled={!enabled || busy || !restored} onClick={() => void create()}><Smartphone className="mr-2 h-4 w-4" />{busy ? 'Creating link…' : 'Upload from phone'}</Button> : <div className="flex flex-wrap items-start gap-4 rounded-lg border border-border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {session.qrDataUrl ? <img src={session.qrDataUrl} width={220} height={220} alt="Scan to upload drawing photos to this draft" className="rounded-md bg-white" /> : null}
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-semibold">Scan, choose photos, then tap Upload</p>
        <p className="text-muted-foreground">Phone and PC must reach the same ShopApp address—use shop Wi-Fi or Tailscale. This link only accepts photos for this {context.destination}.</p>
        <p role="status">{session.count} photos received{session.status === 'READY' ? ' · Starting drawing review…' : ' · Waiting for phone'}</p>
        <p className="text-muted-foreground">Expires at {new Date(session.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Keep this draft open; received photos are held for 24 hours.</p>
        {session.url ? <p className="break-all text-xs text-muted-foreground">Phone address: {session.url.split('#')[0]}</p> : <p>Waiting on your existing phone link. Close it and create a new link to display another QR code.</p>}
        <div className="flex flex-wrap gap-3">
          {session.relativeUrl ? <a href={session.relativeUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open upload page on this PC</a> : null}
          <button type="button" disabled={busy} className="underline" onClick={() => void close()}>Close link</button>
          {session.count > 0 && session.status === 'OPEN' ? <button type="button" disabled={busy} className="text-primary underline" onClick={() => void importReceivedPhotos()}>Use received photos now</button> : null}
        </div>
      </div>
    </div>}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
