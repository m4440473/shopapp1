'use client';
import * as React from 'react';
import { PHONE_UPLOAD_LIMITS as limits, type PhoneUploadStatus } from '@/modules/phone-upload/phone-upload.types';
import {
  preflightPhoneUploadSelection,
  runBoundedPhoneUploads,
  type PhoneUploadQueueState,
} from '@/modules/phone-upload/phone-upload.client';
import { Button } from '@/components/ui/Button';
type Photo = { id: string; file: File; url: string; state: PhoneUploadQueueState; error?: string };
class PhoneRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function PhonePhotoUpload({ id }: { id: string }) {
  const [token, setToken] = React.useState('');
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [remote, setRemote] = React.useState<PhoneUploadStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [progress, setProgress] = React.useState('');
  const urls = React.useRef<string[]>([]);
  const photosRef = React.useRef<Photo[]>([]);
  const updatePhotos = React.useCallback((updater: (current: Photo[]) => Photo[]) => {
    const next = updater(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
  }, []);
  React.useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  async function request(method: string, capability: string, photo?: Photo) {
    const attempts = photo ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await fetch(`/api/phone-upload/${encodeURIComponent(id)}`, {
        method, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'x-phone-upload-token': capability, ...(photo ? { 'Content-Type': photo.file.type, 'x-photo-filename': encodeURIComponent(photo.file.name), 'x-photo-id': photo.id } : {}) }, body: photo?.file,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data as PhoneUploadStatus;
      const problem = new PhoneRequestError(data.error || 'Upload failed. Please retry.', response.status);
      if (attempt + 1 >= attempts || ![409, 429, 503].includes(response.status)) throw problem;
      await new Promise(resolve => window.setTimeout(resolve, 300 * (attempt + 1)));
    }
    throw new PhoneRequestError('Upload failed. Please retry.', 500);
  }
  React.useEffect(() => {
    let active = true;
    const capability = window.location.hash.slice(1);
    setToken(capability);
    if (!/^[a-f0-9]{64}$/.test(capability)) { setError('This upload link is incomplete. Scan the QR code again.'); return; }
    void request('GET', capability).then(data => { if (active) setRemote(data); }).catch(problem => { if (active) setError(problem.message); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  function select(files: FileList | null) {
    if (!files) return;
    setError('');
    const candidates: Photo[] = [];
    const validationErrors: string[] = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > limits.fileBytes || file.size === 0) {
        validationErrors.push(`${file.name}: choose a JPG, PNG or WebP photo under 20 MB. For HEIC, export as JPG.`);
        continue;
      }
      const url = URL.createObjectURL(file); urls.current.push(url);
      candidates.push({ id: crypto.randomUUID?.() || `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`, file, url, state: 'queued' });
    }
    const current = photosRef.current;
    const localPending = current.filter(photo => photo.state !== 'uploaded');
    const result = preflightPhoneUploadSelection({
      existingCount: (remote?.count ?? 0) + localPending.length,
      existingBytes: (remote?.bytes ?? 0) + localPending.reduce((sum, photo) => sum + photo.file.size, 0),
      candidates: candidates.map(photo => ({ id: photo.id, value: photo, size: photo.file.size })),
    });
    const acceptedIds = new Set(result.accepted.map(item => item.id));
    for (const candidate of candidates) {
      if (!acceptedIds.has(candidate.id)) URL.revokeObjectURL(candidate.url);
    }
    if (result.rejected.length) validationErrors.push(...result.rejected.map(item => `${item.value.file.name}: ${item.reason}`));
    if (validationErrors.length) setError(validationErrors.join(' '));
    const accepted = result.accepted.map(item => item.value);
    updatePhotos(existing => [...existing, ...accepted]);
    if (accepted.length) void upload(accepted);
  }
  async function upload(selectedPhotos?: Photo[]) {
    setBusy(true); setError('');
    try {
      const pending = selectedPhotos ?? photosRef.current.filter(photo => photo.state !== 'uploaded');
      let completed = 0;
      const results = await runBoundedPhoneUploads({
        items: pending.map(photo => ({ id: photo.id, value: photo, size: photo.file.size })),
        upload: async ({ value }) => {
          const status = await request('POST', token, value);
          setRemote(current => current && current.count > status.count ? current : status);
        },
        onState: (photoId, state, problem) => {
          if (state === 'uploaded' || state === 'failed') completed += 1;
          setProgress(`Uploading photos… ${completed} of ${pending.length} finished`);
          updatePhotos(current => current.map(item => item.id === photoId ? { ...item, state, error: problem } : item));
        },
      });
      const failures = results.filter(result => result.state === 'failed');
      if (failures.length) {
        setError(`${failures.length} photo${failures.length === 1 ? '' : 's'} could not upload. The completed photos are safe; retry only the failed photos below.`);
        return;
      }
      setProgress('Starting drawing review automatically…');
      setRemote(await request('PATCH', token)); setProgress('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Upload failed. Retry to continue without resending completed photos.'); }
    finally { setBusy(false); }
  }
  const done = remote && ['READY', 'IMPORTED'].includes(remote.status);
  return <div data-phone-upload className="mx-auto max-w-lg space-y-4">
    <style>{'body:has([data-phone-upload]) [data-app-chrome]{display:none} body:has([data-phone-upload]) main>.container{padding-top:1.5rem;padding-bottom:1.5rem}'}</style>
    <h1 className="text-2xl font-semibold">Send drawing photos</h1>
    {done ? <div role="status" className="space-y-2 rounded-lg border border-primary/40 p-4"><p className="font-semibold">{remote.count} photos sent successfully.</p><p>Return to your computer. The photos will enter its drawing review automatically. You can close this page.</p></div> : <>
      <p className="text-sm text-muted-foreground">Fill the picture with the drawing. Keep it flat, sharp and well lit, including the title block. Selected photos upload immediately.</p>
      {!remote && !error ? <p role="status">Checking upload link…</p> : null}
      {remote?.status === 'OPEN' ? <>
        <div className="grid grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-md bg-primary p-3 text-center font-medium text-primary-foreground">Take a photo<input aria-label="Take a photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={event => { select(event.target.files); event.target.value = ''; }} /></label>
          <label className="cursor-pointer rounded-md border border-border p-3 text-center">Choose photos<input aria-label="Choose photos" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => { select(event.target.files); event.target.value = ''; }} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">{photos.map(photo => <div key={photo.id} className="min-w-0 space-y-1 rounded-md border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`Preview of ${photo.file.name}`} className="h-40 w-full rounded object-contain" />
          <p className="truncate text-xs">{photo.file.name}</p>
          {photo.state === 'uploaded' ? <p className="text-xs text-primary">Uploaded</p> : null}
          {photo.state === 'uploading' ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
          {photo.state === 'failed' ? <p className="text-xs text-destructive">{photo.error || 'Upload failed — retry below'}</p> : null}
          {photo.state !== 'uploaded' && photo.state !== 'uploading' ? <button type="button" disabled={busy} className="text-sm underline" onClick={() => { URL.revokeObjectURL(photo.url); updatePhotos(current => current.filter(item => item.id !== photo.id)); }}>Remove / retake</button> : null}
        </div>)}</div>
        {remote.count ? <p className="text-sm">{remote.count} photos already received. Refreshing does not delete them.</p> : null}
        {photos.some(photo => photo.state === 'failed') || (error && remote.count) ? <Button type="button" className="w-full" disabled={busy} onClick={() => void upload()}>{busy ? 'Uploading…' : photos.some(photo => photo.state === 'failed') ? 'Retry failed photos' : 'Retry / finish upload'}</Button> : null}
        {progress ? <p role="status" className="text-sm">{progress}</p> : null}
        <p className="text-xs text-muted-foreground">Upload-only link · valid for 30 minutes · JPG/PNG/WebP · 20 MB per photo. Leave this page open until sent.</p>
      </> : null}
    </>}
    {error ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">{error}</p> : null}
  </div>;
}
