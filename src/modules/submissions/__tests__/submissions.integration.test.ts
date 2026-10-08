import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, root: '', actor: 'actor-a', finalize: vi.fn(async () => undefined) }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = state.db[String(key)]; return typeof value === 'function' ? value.bind(state.db) : value;
} }) }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: async () => state.actor ? { user: { id: state.actor, role: 'ADMIN' } } : null }));
vi.mock('@/lib/app-settings', () => ({ getAppSettings: async () => ({ attachmentsDir: state.root, requirePOForQuoteToOrder: false }) }));
vi.mock('@/repos/orders', async () => ({ ...await import('@/modules/orders/orders.create.repo'),
  listAddonsByIds: async (ids: string[]) => state.db.addon.findMany({ where: { id: { in: ids } } }),
  listDepartmentsOrdered: async () => state.db.department.findMany({ orderBy: { sortOrder: 'asc' } }),
}));
vi.mock('@/modules/orders/orders.files.service', () => ({ ensureOrderFilesInCanonicalStorage: () => state.finalize() }));
vi.mock('@/modules/orders/orders.service', async () => ({
  ...await import('@/modules/orders/orders.create.service'),
  generateNextOrderNumber: (business: string) => import('@/modules/orders/orders.create.repo').then(repo => repo.generateNextOrderNumber(business as 'STD')),
  syncChecklistForOrder: async () => undefined, initializeCurrentDepartmentForOrder: async () => undefined,
  syncOrderWorkflowStatus: async () => undefined, ensureOrderFilesInCanonicalStorage: () => state.finalize(),
}));
vi.mock('@/modules/drawing-import/drawing-import.service', () => ({ detectPurchaseOrderFromStoredPdfAttachments: async () => null }));

import { POST as direct } from '@/app/api/orders/route';
import { POST as quote } from '@/app/api/admin/quotes/route';
import { PATCH as updateQuote } from '@/app/api/admin/quotes/[id]/route';
import { POST as repeat } from '@/app/api/repeat-order-templates/[id]/create-order/route';
import { POST as convert } from '@/app/api/admin/quotes/[id]/convert/route';
import { GET as status } from '@/app/api/submissions/status/route';
import { lookupPendingCreationSubmission, submitPendingCreationSubmission } from '../submissions.client';
import { submissionIdentity, runCreationSubmission } from '../submissions.service';
import { submissionFields } from '../submissions.shared';

beforeAll(async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-submission-'));
  await writeFile(path.join(state.root, 'test.db'), '');
  await writeFile(path.join(state.root, 'synthetic.txt'), 'Synthetic attachment retained after creation.');
  const url = `file:${path.join(state.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], { env: { ...process.env, DATABASE_URL: url }, timeout: 60_000, stdio: 'pipe' });
  state.db = new PrismaClient({ datasources: { db: { url } } });
  await state.db.user.createMany({ data: [{ id: 'actor-a', name: 'Synthetic A', email: 'a@example.invalid', role: 'ADMIN' }, { id: 'actor-b', name: 'Synthetic B', email: 'b@example.invalid', role: 'ADMIN' }] });
  await state.db.customer.create({ data: { id: 'customer', name: 'Synthetic customer' } });
  await state.db.department.create({ data: { id: 'machining', name: 'Machining', slug: 'machining', sortOrder: 1 } });
  await state.db.repeatOrderTemplate.create({ data: { id: 'template', name: 'Synthetic repeat', business: 'STD', customerId: 'customer', priority: 'NORMAL', parts: { create: [{ partNumber: 'REPEAT-PART', quantity: 2 }] } } });
  const templatePart = await state.db.repeatOrderTemplatePart.findFirstOrThrow({ where: { templateId: 'template' } });
  await state.db.repeatOrderTemplateAttachment.createMany({ data: [
    { templateId: 'template', ...attachment() },
    { templateId: 'template', templatePartId: templatePart.id, kind: 'DWG', ...attachment() },
  ] });
}, 60_000);
beforeEach(() => { state.actor = 'actor-a'; state.finalize.mockReset().mockResolvedValue(undefined); });
afterAll(async () => {
  await state.db?.$disconnect();
  if (path.dirname(state.root) === path.resolve(os.tmpdir()) && path.basename(state.root).startsWith('shopapp-submission-')) await rm(state.root, { recursive: true, force: true });
});
function req(url: string, body: unknown, key = randomUUID(), method = 'POST') { return new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }); }
function orderBody() { return { business: 'STD', customerId: 'customer', receivedDate: '2026-09-11', dueDate: '2026-09-18', parts: [{ partNumber: `PART-${randomUUID()}`, quantity: 2 }] }; }
function quoteBody() { return { business: 'STD', companyName: 'Synthetic customer', customerId: 'customer', parts: [{ name: 'Bracket', partNumber: `Q-PART-${randomUUID()}`, quantity: 2, notes: 'Preserve related data' }] }; }
function attachment() { return { storagePath: 'synthetic.txt', label: 'synthetic.txt', mimeType: 'text/plain' }; }
async function expectReadableOrderAttachments(orderId: string) {
  const files = [...await state.db.attachment.findMany({ where: { orderId } }), ...await state.db.partAttachment.findMany({ where: { orderId } })];
  expect(files).toHaveLength(2);
  for (const file of files) expect(await readFile(path.join(state.root, file.storagePath!), 'utf8')).toBe('Synthetic attachment retained after creation.');
  expect(await readFile(path.join(state.root, 'synthetic.txt'), 'utf8')).toBe('Synthetic attachment retained after creation.');
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe('durable creation identities through authenticated API + real SQLite', () => {
  it('stores catalog cents as dollar-denominated order charges and preserves them on replay', async () => {
    await state.db.addon.createMany({ data: [
      { id: 'priced-hourly', name: 'Machining', rateType: 'HOURLY', rateCents: 5040, departmentId: 'machining', affectsPrice: true, isChecklistItem: true },
      { id: 'priced-flat', name: 'Inspection', rateType: 'FLAT', rateCents: 175, departmentId: 'machining', affectsPrice: true, isChecklistItem: true },
    ] });
    const key = randomUUID();
    const body = orderBody();
    const payload = { ...body, parts: [{ ...body.parts[0], addonSelections: [{ addonId: 'priced-hourly', units: 1.25 }, { addonId: 'priced-flat', units: 2 }] }] };
    const response = await direct(req('/api/orders', payload, key));
    expect(response.status).toBe(201);
    const created = await response.json();
    const charges = await state.db.orderCharge.findMany({ where: { orderId: created.id }, orderBy: { sortOrder: 'asc' } });
    expect(charges.map(charge => ({ unitPrice: String(charge.unitPrice), quantity: String(charge.quantity), total: String(charge.unitPrice.mul(charge.quantity)) }))).toEqual([
      { unitPrice: '50.4', quantity: '1.25', total: '63' },
      { unitPrice: '1.75', quantity: '2', total: '3.5' },
    ]);
    const replay = await direct(req('/api/orders', payload, key));
    expect((await replay.json()).id).toBe(created.id);
    expect(await state.db.orderCharge.findMany({ where: { orderId: created.id }, orderBy: { sortOrder: 'asc' } })).toEqual(charges);
    expect(await state.db.orderChecklist.count({ where: { orderId: created.id } })).toBe(2);
  });

  it('recovers a lost direct-order response and concurrent identical clicks without another order or part', async () => {
    const pending = { version: 1 as const, key: randomUUID(), scope: 'order:create' as const, url: '/api/orders', payload: orderBody() };
    const before = await state.db.order.count();
    const lost = await submitPendingCreationSubmission(pending, (async (_url, init) => { await direct(req(pending.url, JSON.parse(String(init?.body)), pending.key)); throw new Error('response lost'); }) as typeof fetch);
    expect(lost.state).toBe('unknown');
    const responses = await Promise.all([direct(req(pending.url, pending.payload, pending.key)), direct(req(pending.url, pending.payload, pending.key))]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const [a, b] = await Promise.all(responses.map(response => response.json()));
    expect(a.id).toBe(b.id);
    expect(await state.db.order.count()).toBe(before + 1);
    expect(await state.db.orderPart.count({ where: { orderId: a.id } })).toBe(1);
    const checked = await lookupPendingCreationSubmission(pending, (async url => status(new NextRequest(`http://localhost${url}`))) as typeof fetch);
    expect(checked).toMatchObject({ state: 'created', id: a.id });
  });

  it('deduplicates simultaneous first quote submissions and retries distinct automatic numbers', async () => {
    const body = quoteBody(), key = randomUUID();
    const before = await state.db.quote.count();
    const responses = await Promise.all([quote(req('/api/admin/quotes', body, key)), quote(req('/api/admin/quotes', body, key))]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const [a, b] = await Promise.all(responses.map(response => response.json()));
    expect(a.item.id).toBe(b.item.id);
    expect(await state.db.quote.count()).toBe(before + 1);
    const distinct = await Promise.all([quote(req('/api/admin/quotes', quoteBody())), quote(req('/api/admin/quotes', quoteBody()))]);
    const values = await Promise.all(distinct.map(response => response.json()));
    expect(distinct.map(response => response.status), JSON.stringify(values)).toEqual([200, 200]);
    expect(new Set(values.map(value => value.item.quoteNumber)).size).toBe(2);
  });

  it('rejects payload reuse, scopes recovery to owner and operation, and does not poison corrected invalid input', async () => {
    const key = randomUUID(), body = orderBody();
    expect((await direct(req('/api/orders', { ...body, parts: [] }, key))).status).toBe(400);
    const created = await (await direct(req('/api/orders', body, key))).json();
    expect((await direct(req('/api/orders', { ...body, poNumber: 'CHANGED' }, key))).status).toBe(409);
    state.actor = 'actor-b';
    expect(await (await status(new NextRequest(`http://localhost/api/submissions/status?scope=order:create&key=${key}`))).json()).toEqual({ state: 'unknown' });
    state.actor = 'actor-a';
    expect(await (await status(new NextRequest(`http://localhost/api/submissions/status?scope=quote:create&key=${key}`))).json()).toEqual({ state: 'unknown' });
    expect(await (await status(new NextRequest(`http://localhost/api/submissions/status?scope=order:create&key=${key}`))).json()).toMatchObject({ state: 'created', id: created.id });
    state.actor = '';
    expect((await status(new NextRequest(`http://localhost/api/submissions/status?scope=order:create&key=${key}`))).status).toBe(401);
  });

  it('rolls back a created quote and its identity when a child write fails, allowing correction with the same key', async () => {
    const key = randomUUID(), body = quoteBody(), before = await state.db.quote.count();
    const broken = await quote(req('/api/admin/quotes', { ...body, parts: [{ ...body.parts[0], materialId: 'missing-material' }] }, key));
    expect(broken.status).toBe(400);
    expect(await broken.json()).toMatchObject({ code: 'INVALID_QUOTE_REFERENCE' });
    expect(await state.db.quote.count()).toBe(before);
    expect((await quote(req('/api/admin/quotes', body, key))).status).toBe(200);
    expect(await state.db.quote.count()).toBe(before + 1);
  });

  it('recovers repeat-order creation after postcommit finalization fails and never repeats template parts', async () => {
    const key = randomUUID(), url = '/api/repeat-order-templates/template/create-order', body = { dueDate: '2026-09-20' };
    const before = await state.db.order.count();
    state.finalize.mockRejectedValue(new Error('Synthetic postcommit file failure'));
    const a = await repeat(req(url, body, key), context('template'));
    const b = await repeat(req(url, body, key), context('template'));
    expect([a.status, b.status]).toEqual([201, 201]);
    const result = await a.json();
    expect(result.id).toBe((await b.json()).id);
    expect(await state.db.order.count()).toBe(before + 1);
    expect(state.finalize).toHaveBeenCalledTimes(1);
    await expectReadableOrderAttachments(result.id);
  });

  it('recovers conversion before the already-converted check and keeps the original source quote/order link', async () => {
    const source = quoteBody();
    const createdQuote = await (await quote(req('/api/admin/quotes', { ...source, attachments: [attachment()], parts: [{ ...source.parts[0], attachments: [{ kind: 'DWG', ...attachment() }] }] }))).json();
    const id = createdQuote.item.id, key = randomUUID(), url = `/api/admin/quotes/${id}/convert`, body = { dueDate: '2026-09-20' };
    const before = await state.db.order.count();
    state.finalize.mockRejectedValue(new Error('Synthetic conversion finalization failure'));
    const first = await convert(req(url, body, key), context(id));
    const replay = await convert(req(url, body, key), context(id));
    expect([first.status, replay.status]).toEqual([200, 200]);
    const a = await first.json(), b = await replay.json();
    expect(a.orderId).toBe(b.orderId);
    expect(await state.db.order.count()).toBe(before + 1);
    expect(await state.db.order.findUnique({ where: { id: a.orderId } })).toMatchObject({ sourceQuoteId: id });
    await expectReadableOrderAttachments(a.orderId);
  });

  it('rejects stale quote updates before touching parts and returns a version for the next edit', async () => {
    const originalBody = quoteBody();
    const created = await (await quote(req('/api/admin/quotes', originalBody))).json();
    const id = created.item.id, version = created.item.updatedAt;
    const editedBody = { ...originalBody, companyName: 'Latest saved name', expectedUpdatedAt: version, parts: [{ ...originalBody.parts[0], id: created.item.parts[0].id }] };
    const saved = await updateQuote(req(`/api/admin/quotes/${id}`, editedBody, randomUUID(), 'PATCH'), context(id));
    expect(saved.status).toBe(200);
    expect((await saved.json()).item.updatedAt).not.toBe(version);
    const before = await state.db.quote.findUnique({ where: { id }, include: { parts: true } });
    const stale = await updateQuote(req(`/api/admin/quotes/${id}`, { ...editedBody, companyName: 'Stale overwrite', parts: [] }, randomUUID(), 'PATCH'), context(id));
    expect(stale.status).toBe(409);
    expect(await state.db.quote.findUnique({ where: { id }, include: { parts: true } })).toEqual(before);
  });

  it('recovers an independent writer unique-key winner after a creation error', async () => {
    const identity = submissionIdentity({ actorId: 'actor-a', scope: 'order:create', clientKey: randomUUID(), payload: { arbitrary: 'test' } })!;
    const result = await runCreationSubmission(identity, async () => {
      const saved = await state.db.order.create({ data: { ...submissionFields(identity), orderNumber: `TEST-${randomUUID()}`, customerId: 'customer', business: 'STD', status: 'RECEIVED', priority: 'NORMAL', receivedDate: new Date(), dueDate: new Date() } });
      expect(saved.id).toBeTruthy();
      throw Object.assign(new Error('unique-key loser or lost response'), { code: 'P2002' });
    }, async record => record.id);
    expect(result).toBeTruthy();
  });
});
