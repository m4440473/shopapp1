import 'server-only';
import path from 'node:path';
import { mkdir, readFile, writeFile, rename, open, unlink, readdir, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { PhoneUploadSession } from './phone-upload.types';
import { PhoneUploadError } from './phone-upload.types';

// Not under ATTACHMENTS_DIR or public: no attachment endpoint can serve these files.
export function phoneUploadRoot() { return path.resolve(process.env.PHONE_UPLOAD_DIR || '.phone-uploads'); }
function sessionPath(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new PhoneUploadError('Upload link is invalid or expired.', 404);
  return path.join(phoneUploadRoot(), id);
}
async function locked<T>(lockPath: string, work: () => Promise<T>, waitMs = 0): Promise<T> {
  // A terminated process may leave its marker; uploads are bounded and import handoff is short.
  try { if (Date.now() - (await stat(lockPath)).mtimeMs > 5 * 60_000) await unlink(lockPath); } catch { /* absent */ }
  const deadline = Date.now() + Math.max(0, waitMs);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  for (;;) {
    try {
      handle = await open(lockPath, 'wx');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new PhoneUploadError('Another upload is finishing. Please retry in a moment.', 409);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try { return await work(); } finally { await handle.close(); await unlink(lockPath).catch(() => {}); }
}
export async function readPhoneSession(id: string): Promise<PhoneUploadSession> {
  try { return JSON.parse(await readFile(path.join(sessionPath(id), 'session.json'), 'utf8')); }
  catch { throw new PhoneUploadError('Upload link is invalid or expired.', 404); }
}
async function save(session: PhoneUploadSession) {
  const dir = sessionPath(session.id);
  const temporary = path.join(dir, `${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(session), { mode: 0o600 });
  await rename(temporary, path.join(dir, 'session.json'));
}
export async function createPhoneSessionRecord(session: PhoneUploadSession) {
  const root = phoneUploadRoot();
  await mkdir(root, { recursive: true });
  await locked(path.join(root, '.create.lock'), async () => {
    let total = 0, owned = 0;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-f0-9]{32}$/.test(entry.name)) continue;
      const previous = await readPhoneSession(entry.name).catch(() => null);
      if (previous && previous.retainUntil < Date.now()) {
        // Exact validated session child only, never the staging root itself.
        const target = sessionPath(entry.name);
        if (path.dirname(target) !== root) throw new Error('Invalid staging cleanup target.');
        await rm(target, { recursive: true, force: true });
        continue;
      }
      total++;
      if (previous?.ownerId === session.ownerId && previous.expiresAt > Date.now() && ['OPEN', 'READY'].includes(previous.status)) owned++;
    }
    if (total >= 100 || owned >= 5) throw new PhoneUploadError('Too many phone upload sessions. Close an existing link or try later.', 429);
    await mkdir(sessionPath(session.id));
    await save(session);
  });
}
export async function updatePhoneSession<T>(id: string, work: (session: PhoneUploadSession) => Promise<T>) {
  await readPhoneSession(id); // validates existence before opening lock
  // Two phone uploads are intentionally allowed to normalize concurrently. Wait
  // briefly for the small session commit rather than rejecting the second file.
  return locked(path.join(sessionPath(id), '.lock'), async () => {
    const session = await readPhoneSession(id);
    const result = await work(session);
    await save(session);
    return result;
  }, 5_000);
}
export async function storePhonePhoto(id: string, fileId: string, bytes: Buffer) {
  if (!/^[a-f0-9]{32}$/.test(fileId)) throw new Error('Invalid internal photo ID.');
  await writeFile(path.join(sessionPath(id), `${fileId}.jpg`), bytes, { mode: 0o600 });
}
export async function readPhonePhoto(id: string, fileId: string) {
  if (!/^[a-f0-9]{32}$/.test(fileId)) throw new Error('Invalid internal photo ID.');
  return readFile(path.join(sessionPath(id), `${fileId}.jpg`));
}
