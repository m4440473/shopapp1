import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ start: vi.fn(), snapshot: vi.fn(), enabled: true }));
vi.mock('@/modules/drawing-import/v2/drawing-import-v2.service', () => ({
  getQuoteDrawingImportV2FeatureStatus: () => ({ enabled: mocked.enabled }),
  createQuoteDrawingImportV2Job: mocked.start,
  getQuoteDrawingImportV2JobSnapshot: mocked.snapshot,
}));
import { addPhonePhoto, claimPhoneUpload, createPhoneUpload, finishOwnedPhoneUpload, finishPhoneUpload, getOwnedPhoneUpload, getPhoneUpload, phoneUploadOrigin, revokePhoneUpload } from '../phone-upload.service';
import { readPhoneSession, updatePhoneSession } from '../phone-upload.repo';
import { boundedBody, sameOrigin } from '../phone-upload.http';
const context = { destination: 'quote' as const, business: 'Sterling Tool and Die', customerName: 'Synthetic only', draftReference: 'SYN-123', intakeMode: 'ASSEMBLY' as const, assemblyMultiplier: 3 };
let root: string;
let bytes: Buffer;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-phone-test-'));
  vi.stubEnv('PHONE_UPLOAD_DIR', root);
  vi.stubEnv('PHONE_UPLOAD_PUBLIC_ORIGIN', 'http://192.168.1.50:3000');
  mocked.enabled = true; mocked.start.mockReset(); mocked.snapshot.mockReset();
  mocked.start.mockResolvedValue({ progress: { jobId: 'job-test' }, pages: [], supportingFiles: [] });
  mocked.snapshot.mockResolvedValue({ progress: { jobId: 'job-test' }, pages: [], supportingFiles: [] });
  bytes = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
async function session() { const created = await createPhoneUpload('owner', context, 'http://localhost:3000'); return { ...created, token: created.url.split('#')[1] }; }
const photo = (data: Buffer = bytes, requestId = 'test-photo-00000001') => ({ bytes: data, filename: 'drawing.jpg', mimeType: 'image/jpeg', requestId });
describe('phone upload capability and durable handoff', () => {
  it('recovers received photos on the desktop after the phone expires mid-batch', async () => {
    const s = await session(); await addPhonePhoto(s.id, s.token, photo());
    await updatePhoneSession(s.id, async record => { record.expiresAt = Date.now() - 1; });
    await expect(finishOwnedPhoneUpload(s.id, 'someone-else')).rejects.toMatchObject({ status: 404 });
    expect((await finishOwnedPhoneUpload(s.id, 'owner')).status).toBe('READY');
    expect((await claimPhoneUpload(s.id, 'owner', context)).progress.jobId).toBe('job-test');
  });
  it('generates a local QR with fragment-only token and persists only its hash', async () => {
    const s = await session();
    expect(s.url).toMatch(/^http:\/\/192\.168\.1\.50:3000\/phone-upload\/[a-f0-9]{32}#[a-f0-9]{64}$/);
    expect(s.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(await readFile(path.join(root, s.id, 'session.json'), 'utf8')).not.toContain(s.token);
    expect(await getPhoneUpload(s.id, s.token)).not.toHaveProperty('customerName');
    expect(await getPhoneUpload(s.id, s.token)).not.toHaveProperty('files');
  });
  it('rejects missing/wrong tokens, traversal and another owner', async () => {
    const s = await session();
    await expect(getPhoneUpload(s.id, '')).rejects.toMatchObject({ status: 404 });
    await expect(getPhoneUpload(s.id, 'a'.repeat(64))).rejects.toMatchObject({ status: 404 });
    await expect(getPhoneUpload('../x', s.token)).rejects.toMatchObject({ status: 404 });
    await expect(getOwnedPhoneUpload(s.id, 'other')).rejects.toMatchObject({ status: 404 });
  });
  it('expires/revokes phone access without deleting ready desktop work', async () => {
    const s = await session(); await addPhonePhoto(s.id, s.token, photo()); await finishPhoneUpload(s.id, s.token);
    await updatePhoneSession(s.id, async record => { record.expiresAt = Date.now() - 1; });
    await expect(getPhoneUpload(s.id, s.token)).rejects.toMatchObject({ status: 410 });
    expect((await claimPhoneUpload(s.id, 'owner', context)).progress.jobId).toBe('job-test');
    const other = await session(); await revokePhoneUpload(other.id, 'owner');
    await expect(addPhonePhoto(other.id, other.token, photo())).rejects.toMatchObject({ status: 410 });
  });
  it.each(['quote', 'order'] as const)('routes %s photos once, with immutable context/assembly and source files', async destination => {
    const input = { ...context, destination };
    const s = await createPhoneUpload('owner', input, 'http://localhost:3000'); const token = s.url.split('#')[1];
    await addPhonePhoto(s.id, token, photo()); await addPhonePhoto(s.id, token, photo(bytes, 'test-photo-00000002'));
    await finishPhoneUpload(s.id, token); await claimPhoneUpload(s.id, 'owner', input); await claimPhoneUpload(s.id, 'owner', input);
    expect(mocked.start).toHaveBeenCalledTimes(1);
    const call = mocked.start.mock.calls[0][0];
    expect(call).toMatchObject({ ...input, createdById: 'owner', idempotencyKey: `phone-upload-${s.id}` });
    const zip = await JSZip.loadAsync(call.buffer); expect(Object.keys(zip.files)).toHaveLength(2);
    expect((await getPhoneUpload(s.id, token)).status).toBe('IMPORTED');
  });
  it('does not run AI from the phone, rejects empty finish or wrong draft/destination', async () => {
    const s = await session();
    await expect(finishPhoneUpload(s.id, s.token)).rejects.toMatchObject({ status: 400 });
    await addPhonePhoto(s.id, s.token, photo()); await finishPhoneUpload(s.id, s.token);
    expect(mocked.start).not.toHaveBeenCalled();
    await expect(claimPhoneUpload(s.id, 'owner', { ...context, draftReference: 'other' })).rejects.toMatchObject({ status: 409 });
    await expect(claimPhoneUpload(s.id, 'owner', { ...context, destination: 'order' })).rejects.toMatchObject({ status: 409 });
  });
  it('retries uploads without duplicating photos and rejects conflicting retry IDs', async () => {
    const s = await session(); await addPhonePhoto(s.id, s.token, photo());
    expect((await addPhonePhoto(s.id, s.token, photo())).count).toBe(1);
    const different = await sharp(bytes).negate().jpeg().toBuffer();
    await expect(addPhonePhoto(s.id, s.token, photo(different))).rejects.toMatchObject({ status: 409 });
    await finishPhoneUpload(s.id, s.token);
    await expect(addPhonePhoto(s.id, s.token, photo(bytes, 'test-photo-new-0002'))).rejects.toMatchObject({ status: 409 });
  });
  it('preserves READY batch after interrupted importer call and reuses idempotency key', async () => {
    const s = await session(); await addPhonePhoto(s.id, s.token, photo()); await finishPhoneUpload(s.id, s.token);
    mocked.start.mockRejectedValueOnce(new Error('temporary outage'));
    await expect(claimPhoneUpload(s.id, 'owner', context)).rejects.toThrow('temporary outage');
    expect((await readPhoneSession(s.id)).status).toBe('READY');
    await claimPhoneUpload(s.id, 'owner', context);
    expect(mocked.start.mock.calls[0][0].idempotencyKey).toBe(mocked.start.mock.calls[1][0].idempotencyKey);
  });
  it('rejects invalid content, extension/MIME mismatch and oversized images', async () => {
    const s = await session();
    await expect(addPhonePhoto(s.id, s.token, photo(Buffer.from('<script/>')))).rejects.toMatchObject({ status: 400 });
    await expect(addPhonePhoto(s.id, s.token, { ...photo(), filename: 'drawing.png' })).rejects.toMatchObject({ status: 400 });
    await expect(addPhonePhoto(s.id, s.token, { ...photo(), mimeType: 'text/html' })).rejects.toMatchObject({ status: 400 });
    await expect(addPhonePhoto(s.id, s.token, photo(Buffer.alloc(20 * 1024 * 1024 + 1)))).rejects.toMatchObject({ status: 413 });
  });
  it('bounds photo count and total stored bytes', async () => {
    const s = await session(); await addPhonePhoto(s.id, s.token, photo());
    await updatePhoneSession(s.id, async record => { record.files = Array.from({ length: 100 }, (_, index) => ({ ...record.files[0], requestId: `existing-${index}` })); });
    await expect(addPhonePhoto(s.id, s.token, photo())).rejects.toMatchObject({ status: 413 });
    await updatePhoneSession(s.id, async record => { record.files = [{ ...record.files[0], size: 95 * 1024 * 1024 }]; });
    await expect(addPhonePhoto(s.id, s.token, photo())).rejects.toMatchObject({ status: 413 });
  });
  it('rejects disabled intake and bounds creation sessions', async () => {
    mocked.enabled = false; await expect(session()).rejects.toMatchObject({ status: 400 }); mocked.enabled = true;
    for (let i = 0; i < 5; i++) await session();
    await expect(session()).rejects.toMatchObject({ status: 429 });
  });
  it('rejects cross-site writes and enforces streaming byte caps', async () => {
    expect(() => sameOrigin(new Request('http://local/api', { headers: { origin: 'http://evil' } }))).toThrow('Cross-site');
    await expect(boundedBody(new Request('http://local/api', { method: 'POST', body: '12345' }), 4)).rejects.toMatchObject({ status: 413 });
    expect((await boundedBody(new Request('http://local/api', { method: 'POST', body: '1234' }), 4)).toString()).toBe('1234');
  });
  it('validates configured QR origins', () => {
    vi.stubEnv('PHONE_UPLOAD_PUBLIC_ORIGIN', 'https://shopapp.tail.test'); expect(phoneUploadOrigin('http://localhost:3000')).toBe('https://shopapp.tail.test');
    vi.stubEnv('PHONE_UPLOAD_PUBLIC_ORIGIN', 'https://user:pass@bad.test'); expect(() => phoneUploadOrigin('http://localhost:3000')).toThrow();
  });
  it('accepts browser-facing localhost/LAN hosts but still rejects cross-site requests', () => {
    for (const host of ['localhost:3001', '192.168.254.132:3001']) {
      expect(() => sameOrigin(new Request('http://0.0.0.0:3001/api/admin/phone-upload', { headers: { host, origin: `http://${host}` } }))).not.toThrow();
      expect(() => sameOrigin(new Request('http://0.0.0.0:3001/api/admin/phone-upload', { headers: { host, origin: 'http://evil.test' } }))).toThrow('Cross-site');
    }
    expect(() => sameOrigin(new Request('http://localhost:3000/api', { headers: { host: 'shopapp.test', origin: 'https://shopapp.test', 'x-forwarded-proto': 'https' } }))).not.toThrow();
    expect(() => sameOrigin(new Request('http://localhost:3000/api', { headers: { host: 'shopapp.test', origin: 'null' } }))).toThrow('Cross-site');
  });
});
