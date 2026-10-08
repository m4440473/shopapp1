import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ db: null as unknown as PrismaClient, root: '', user: null as { id: string; role: string } | null }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = runtime.db[String(key)]; return typeof value === 'function' ? value.bind(runtime.db) : value;
} }) }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: async () => runtime.user ? { user: runtime.user } : null }));
import { DELETE, GET, PUT } from '@/app/api/intake-drafts/[kind]/[key]/route';
import { INTAKE_DRAFT_MAX_BYTES } from '../durable-intake-draft.types';

const alice = { id: 'draft-alice', role: 'ADMIN' };
const bob = { id: 'draft-bob', role: 'ADMIN' };
beforeAll(async () => {
  runtime.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-durable-drafts-'));
  await writeFile(path.join(runtime.root, 'test.db'), '');
  const url = `file:${path.join(runtime.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
  for (const user of [alice, bob]) await runtime.db.user.create({ data: { ...user, email: `${user.id}@example.invalid`, active: true } });
}, 60000);
beforeEach(() => { runtime.user = alice; });
afterAll(async () => {
  await runtime.db?.$disconnect();
  if (path.dirname(runtime.root) === path.resolve(os.tmpdir()) && path.basename(runtime.root).startsWith('shopapp-durable-drafts-')) await rm(runtime.root, { recursive: true, force: true });
});
function identity(kind = 'order', key = `edit:${randomUUID()}`) { return { kind, key }; }
async function call(method: 'GET' | 'PUT' | 'DELETE', target: ReturnType<typeof identity>, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const request = new Request(`http://shopapp.local/api/intake-drafts/${target.kind}/${encodeURIComponent(target.key)}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-shopapp-draft-owner': runtime.user?.id ?? '', ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await ({ GET, PUT, DELETE }[method])(request, { params: Promise.resolve(target) });
  return { status: result.status, body: await result.json(), headers: result.headers };
}
function write(data: object, expectedRevision = 0) { return { expectedRevision, mutationId: randomUUID(), data }; }

describe('private durable draft API on real SQLite', () => {
  it('saves incomplete form state and keeps user, kind and workflow identities separate', async () => {
    const target = identity('quote');
    const value = { form: { customerId: '', notes: 'Unfinished work' }, parts: [{ quantity: '', material: null }], attachments: [{ storagePath: 'existing/file.pdf' }] };
    const saved = await call('PUT', target, write(value));
    expect(saved).toMatchObject({ status: 200, body: { ownerId: alice.id, revision: 1, state: 'saved', data: value } });
    expect(saved.headers.get('Cache-Control')).toBe('no-store, private');
    expect((await call('GET', target)).body.data).toEqual(value);
    expect((await call('GET', { ...target, kind: 'order' })).body.state).toBe('missing');
    expect((await call('GET', identity('quote'))).body.state).toBe('missing');
    runtime.user = bob;
    expect((await call('GET', target)).body).toMatchObject({ ownerId: bob.id, state: 'missing', data: null });
    await call('PUT', target, write({ form: { notes: 'Bob private draft' } }));
    runtime.user = alice;
    expect((await call('GET', target)).body.data).toEqual(value);
  });

  it('allows exactly one concurrent revision to win and returns the current owner draft on conflicts', async () => {
    const target = identity();
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => call('PUT', target, write({ index }))));
    expect(results.filter((entry) => entry.status === 200)).toHaveLength(1);
    expect(results.filter((entry) => entry.status === 409)).toHaveLength(9);
    const winner = results.find((entry) => entry.status === 200)!.body;
    const updates = await Promise.all([call('PUT', target, write({ update: 'A' }, 1)), call('PUT', target, write({ update: 'B' }, 1))]);
    expect(updates.map((entry) => entry.status).sort()).toEqual([200, 409]);
    const current = (await call('GET', target)).body;
    expect(current.revision).toBe(2);
    expect(updates.find((entry) => entry.status === 409)!.body.current).toEqual(current);
    expect(winner.revision).toBe(1);
  });

  it('replays an acknowledged mutation after a lost response without incrementing twice', async () => {
    const target = identity(); const request = write({ name: 'Saved once' });
    const first = await call('PUT', target, request);
    expect((await call('PUT', target, request)).body).toEqual(first.body);
    const changed = await call('PUT', target, { ...request, data: { name: 'Different body under same ID' } });
    expect(changed.status).toBe(409);
    expect((await call('GET', target)).body.data.name).toBe('Saved once');
  });

  it('persists clear tombstones so stale create/save requests cannot resurrect discarded work', async () => {
    const target = identity(); const clear = { expectedRevision: 0, mutationId: randomUUID() };
    expect((await call('DELETE', target, clear)).body).toMatchObject({ state: 'cleared', revision: 1, data: null });
    expect((await call('DELETE', target, clear)).body.revision).toBe(1);
    expect((await call('PUT', target, write({ stale: true }))).status).toBe(409);
    expect((await call('PUT', target, write({ stale: true }, 1))).status).toBe(409);
    expect((await call('PUT', target, { ...write({ fresh: true }, 1), reactivate: true })).body).toMatchObject({ revision: 2, state: 'saved' });
    expect((await call('DELETE', target, { expectedRevision: 1, mutationId: randomUUID() })).status).toBe(409);
    expect((await call('GET', target)).body.data).toEqual({ fresh: true });
  });

  it('does not allow a stale-tab clear to erase a more recent save', async () => {
    const target = identity(); await call('PUT', target, write({ stage: 1 }));
    await call('PUT', target, write({ stage: 2 }, 1));
    expect((await call('DELETE', target, { expectedRevision: 1, mutationId: randomUUID() })).status).toBe(409);
    expect((await call('GET', target)).body.data.stage).toBe(2);
  });

  it('rejects unauthenticated, unauthorized, cross-origin and changed-account writes without altering saved state', async () => {
    const target = identity(); await call('PUT', target, write({ intact: true }));
    runtime.user = null;
    expect((await call('GET', target)).status).toBe(401);
    runtime.user = { ...alice, role: 'MACHINIST' };
    expect((await call('PUT', target, write({ changed: true }, 1))).status).toBe(403);
    runtime.user = bob;
    expect((await call('PUT', target, write({ aliceData: 'Must not enter Bob account' }), { 'x-shopapp-draft-owner': alice.id })).status).toBe(403);
    runtime.user = alice;
    expect((await call('PUT', target, write({ changed: true }, 1), { Origin: 'https://foreign.example' })).status).toBe(403);
    expect((await call('GET', target)).body.data).toEqual({ intact: true });
  });

  it('bounds JSON and rejects invalid envelope/identity before any draft row is created', async () => {
    const target = identity();
    expect((await call('PUT', target, { ...write({}), ownerId: bob.id })).status).toBe(400);
    expect((await call('PUT', target, write({ huge: 'x'.repeat(INTAKE_DRAFT_MAX_BYTES + 1) }))).status).toBe(413);
    let deep: object = {}; for (let index = 0; index < 42; index++) deep = { nested: deep };
    expect((await call('PUT', target, write(deep))).status).toBe(413);
    expect((await call('PUT', identity('quote', '../bad'), write({}))).status).toBe(400);
    expect((await call('GET', target)).body.state).toBe('missing');
  });
});
