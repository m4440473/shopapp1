import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import sharp from 'sharp';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { z } from 'zod';
import { BUSINESS_NAMES } from '@/lib/businesses';
import { getQuoteDrawingImportV2FeatureStatus } from '@/modules/drawing-import/v2/drawing-import-v2.service';
import { createPhoneSessionRecord, readPhonePhoto, readPhoneSession, storePhonePhoto, updatePhoneSession } from './phone-upload.repo';
import { PHONE_UPLOAD_LIMITS as limits, PhoneUploadError, type PhoneUploadSession, type PhoneUploadStatus } from './phone-upload.types';

const contextSchema = z.object({
  destination: z.enum(['quote', 'order']),
  business: z.string().refine(value => BUSINESS_NAMES.includes(value as typeof BUSINESS_NAMES[number])),
  customerName: z.string().trim().min(1).max(300), draftReference: z.string().trim().min(1).max(200),
  intakeMode: z.enum(['ONE_OFF', 'ASSEMBLY']), assemblyMultiplier: z.number().int().min(1).max(100000),
});
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const randomId = () => randomBytes(16).toString('hex');
function status(session: PhoneUploadSession): PhoneUploadStatus {
  return { id: session.id, status: session.status, expiresAt: session.expiresAt, count: session.files.length, bytes: session.files.reduce((sum, file) => sum + file.size, 0) };
}
function requireOwner(session: PhoneUploadSession, ownerId: string) {
  if (!ownerId || session.ownerId !== ownerId) throw new PhoneUploadError('Upload session not found.', 404);
  if (session.retainUntil < Date.now()) throw new PhoneUploadError('Upload session expired.', 410);
}
function requireCapability(session: PhoneUploadSession, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(digest(token), 'hex'), Buffer.from(session.tokenHash, 'hex'))) {
    throw new PhoneUploadError('Upload link is invalid or expired.', 404);
  }
  if (session.expiresAt < Date.now() || session.status === 'REVOKED') throw new PhoneUploadError('This upload link has expired or was closed. Ask for a new QR code.', 410);
}
export function phoneUploadOrigin(requestOrigin: string) {
  const configured = process.env.PHONE_UPLOAD_PUBLIC_ORIGIN?.trim();
  const url = new URL(configured || requestOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new PhoneUploadError('Invalid phone upload origin configuration.');
  if (!configured && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    const entries = Object.entries(networkInterfaces()).flatMap(([name, addresses]) => (addresses || []).map(address => ({ ...address, name })));
    const lan = entries.find(address => address.family === 'IPv4' && !address.internal && !/wsl|vethernet|docker/i.test(address.name) && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address));
    if (lan) url.hostname = lan.address;
  }
  return url.origin;
}
export async function createPhoneUpload(ownerId: string, input: unknown, requestOrigin: string) {
  if (!ownerId) throw new PhoneUploadError('Sign in first.', 401);
  if (!getQuoteDrawingImportV2FeatureStatus().enabled) throw new PhoneUploadError('Enable the quote drawing importer before using phone uploads.');
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) throw new PhoneUploadError('Choose a customer, business and drawing intake mode first.');
  const token = randomBytes(32).toString('hex');
  const session: PhoneUploadSession = {
    ...parsed.data, id: randomId(), ownerId, tokenHash: digest(token),
    assemblyMultiplier: parsed.data.intakeMode === 'ASSEMBLY' ? parsed.data.assemblyMultiplier : 1,
    expiresAt: Date.now() + limits.lifetimeMs, retainUntil: Date.now() + 24 * 60 * 60_000,
    status: 'OPEN', files: [],
  };
  const relativeUrl = `/phone-upload/${session.id}#${token}`;
  const url = phoneUploadOrigin(requestOrigin) + relativeUrl;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 4, errorCorrectionLevel: 'M' });
  await createPhoneSessionRecord(session);
  return { ...status(session), url, relativeUrl, qrDataUrl };
}
export async function getPhoneUpload(id: string, token: string) {
  const session = await readPhoneSession(id); requireCapability(session, token); return status(session);
}
export async function getOwnedPhoneUpload(id: string, ownerId: string) {
  const session = await readPhoneSession(id); requireOwner(session, ownerId); return { ...status(session), context: { destination: session.destination, business: session.business, customerName: session.customerName, draftReference: session.draftReference, intakeMode: session.intakeMode, assemblyMultiplier: session.assemblyMultiplier } };
}
let photoProcessors = 0;
export async function addPhonePhoto(id: string, token: string, input: { bytes: Buffer; mimeType: string; filename: string; requestId: string }) {
  await getPhoneUpload(id, token);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) throw new PhoneUploadError('Missing photo retry identifier.');
  if (!input.bytes.length || input.bytes.length > limits.fileBytes) throw new PhoneUploadError('Each photo must be between 1 byte and 20 MB.', 413);
  const ext = input.filename.split('.').pop()?.toLowerCase();
  const formats: Record<string, string[]> = { jpeg: ['jpg', 'jpeg'], png: ['png'], webp: ['webp'] };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) throw new PhoneUploadError('Use JPG, PNG or WebP photos. Export HEIC photos as JPG first.');
  if (photoProcessors >= 2) throw new PhoneUploadError('Photo processing is busy. Please retry shortly.', 429);
  photoProcessors++;
  try {
    const metadata = await sharp(input.bytes, { limitInputPixels: 50_000_000, failOn: 'error' }).metadata().catch(() => null);
    if (!metadata?.format || !formats[metadata.format]?.includes(ext || '') || input.mimeType !== `image/${metadata.format}` || (metadata.pages || 1) > 1) throw new PhoneUploadError('This is not a supported single drawing photo, or its file type does not match.');
    // Preserve full resolution; rotate camera orientation and strip GPS/EXIF before staging.
    const bytes = await sharp(input.bytes, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate().jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
    if (bytes.length > limits.fileBytes) throw new PhoneUploadError('The normalized photo is over 20 MB. Choose a smaller photo.', 413);
    return await updatePhoneSession(id, async session => {
      requireCapability(session, token);
      const previous = session.files.find(file => file.requestId === input.requestId);
      const hash = digest(input.bytes);
      if (previous) {
        if (previous.hash !== hash) throw new PhoneUploadError('Photo retry identifier was already used for a different file.', 409);
        return status(session);
      }
      if (session.status !== 'OPEN') throw new PhoneUploadError('This batch has already been sent. Create a new link to send more.', 409);
      if (session.files.length >= limits.files || status(session).bytes + bytes.length > limits.totalBytes) throw new PhoneUploadError('This batch has reached its 100-photo or 95 MB limit.', 413);
      const fileId = randomId();
      await storePhonePhoto(id, fileId, bytes);
      const name = input.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9 _.-]/g, '_').slice(0, 100) || 'Drawing';
      session.files.push({ id: fileId, filename: `${name}.jpg`, size: bytes.length, hash, requestId: input.requestId });
      return status(session);
    });
  } finally { photoProcessors--; }
}
export async function finishPhoneUpload(id: string, token: string) {
  return updatePhoneSession(id, async session => {
    requireCapability(session, token);
    if (!session.files.length) throw new PhoneUploadError('Choose at least one photo first.');
    if (session.status === 'OPEN') session.status = 'READY';
    return status(session);
  });
}
export async function revokePhoneUpload(id: string, ownerId: string) {
  return updatePhoneSession(id, async session => { requireOwner(session, ownerId); session.status = 'REVOKED'; return status(session); });
}
export async function finishOwnedPhoneUpload(id: string, ownerId: string) {
  return updatePhoneSession(id, async session => {
    requireOwner(session, ownerId);
    if (session.status === 'REVOKED') throw new PhoneUploadError('This link was closed.', 410);
    if (!session.files.length) throw new PhoneUploadError('No photos have arrived yet.');
    if (session.status === 'OPEN') session.status = 'READY';
    return status(session);
  });
}
export async function claimPhoneUpload(id: string, ownerId: string, expectedContext: unknown) {
  return updatePhoneSession(id, async session => {
    requireOwner(session, ownerId);
    const expected = contextSchema.safeParse(expectedContext);
    if (!expected.success || ['destination', 'business', 'customerName', 'draftReference', 'intakeMode', 'assemblyMultiplier'].some(key => session[key as keyof PhoneUploadSession] !== expected.data[key as keyof typeof expected.data])) throw new PhoneUploadError('This phone batch belongs to a different draft or intake mode. Reopen the original draft.', 409);
    if (!['READY', 'IMPORTED'].includes(session.status)) throw new PhoneUploadError('Phone photos are not ready to import.', 409);
    const importer = await import('@/modules/drawing-import/v2/drawing-import-v2.service');
    if (session.jobId) return importer.getQuoteDrawingImportV2JobSnapshot(session.jobId);
    const zip = new JSZip();
    for (const [index, file] of session.files.entries()) zip.file(`${String(index + 1).padStart(3, '0')}-${file.filename}`, await readPhonePhoto(id, file.id));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const snapshot = await importer.createQuoteDrawingImportV2Job({
      createdById: ownerId, destination: session.destination, business: session.business, customerName: session.customerName, draftReference: session.draftReference,
      intakeMode: session.intakeMode, assemblyMultiplier: session.assemblyMultiplier,
      filename: 'Phone-drawings.zip', mimeType: 'application/zip', buffer, idempotencyKey: `phone-upload-${session.id}`,
    });
    session.jobId = snapshot.progress.jobId;
    session.status = 'IMPORTED';
    return snapshot;
  });
}
