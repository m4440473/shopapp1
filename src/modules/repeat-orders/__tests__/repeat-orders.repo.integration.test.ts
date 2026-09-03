import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = holder.db[String(key)];
  return typeof value === 'function' ? value.bind(holder.db) : value;
} }) }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: async () => ({ user: { id: 'admin', role: 'ADMIN' } }) }));
// Keep workflow/storage side effects out of this disposable persistence test.
vi.mock('@/modules/orders/orders.service', () => ({
  generateNextOrderNumber: async () => 'CRM-9000',
  ensureOrderFilesInCanonicalStorage: async () => ({ ok: true }),
  initializeCurrentDepartmentForOrder: async () => ({ ok: true }),
  syncChecklistForOrder: async () => ({ ok: true }),
  syncOrderWorkflowStatus: async () => ({ ok: true }),
}));
import { createRepeatOrderTemplate, findRepeatOrderTemplateById } from '@/modules/repeat-orders/repeat-orders.repo';
import { POST as snapshot } from '@/app/api/repeat-order-templates/from-order/[orderId]/route';
import { GET as prefill } from '@/app/api/repeat-order-templates/[id]/route';
import { POST as createOrder } from '@/app/api/repeat-order-templates/[id]/create-order/route';
let root: string;
beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'repeat-template-regression-'));
  writeFileSync(path.join(root, 'test.db'), '');
  const url = `file:${path.join(root, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  holder.db = new PrismaClient({ datasources: { db: { url } } });
  await holder.db.user.create({ data: { id: 'admin', email: 'synthetic-repeat@example.test', role: 'ADMIN' } });
  await holder.db.customer.create({ data: { id: 'customer', name: 'Synthetic Customer' } });
  await holder.db.order.create({ data: { id: 'order', orderNumber: 'TEST-REPEAT', customerId: 'customer', status: 'RECEIVED', priority: 'NORMAL', receivedDate: new Date(), dueDate: new Date(), parts: { create: { id: 'part', partNumber: 'TEST-1', quantity: 20 } } } });
}, 60000);
afterAll(async () => { await holder.db?.$disconnect(); if (root) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  return {
    customerId: 'customer', sourceOrderId: 'order', sourcePartId: 'part', name: 'Synthetic repeat', business: 'CRM', vendorId: null,
    materialNeeded: false, materialOrdered: false, modelIncluded: false, priority: 'HOT', notes: null,
    parts: [{ partNumber: 'TEST-1', partName: 'Collar', quantity: 20, materialId: null, stockSize: '2 x 42.5', cutLength: '2.125', partWidth: '2', partThickness: '0.125', notes: null, workInstructions: null, instructionsVersion: 1, sortOrder: 0, charges: [],
      attachments: [{ kind: 'IMAGE', url: null, storagePath: 'synthetic/drawing.jpg', label: 'drawing.jpg', mimeType: 'image/jpeg', sortOrder: 0 }] }],
    attachments: [{ kind: 'ORDER', url: null, storagePath: 'synthetic/po.pdf', label: 'po.pdf', mimeType: 'application/pdf', sortOrder: 0 }],
  };
}
it('atomically saves part drawings with both template and part relationships', async () => {
  const created = await createRepeatOrderTemplate(fixture());
  const saved = await findRepeatOrderTemplateById(created.id);
  expect(saved?.parts[0]).toMatchObject({ partNumber: 'TEST-1', quantity: 20, cutLength: '2.125' });
  expect(saved?.parts[0].attachments[0]).toMatchObject({ templateId: created.id, templatePartId: saved?.parts[0].id, storagePath: 'synthetic/drawing.jpg' });
  expect(saved?.attachments).toHaveLength(1);
  expect(saved?.attachments.find(file => file.kind === 'ORDER')?.templatePartId).toBeNull();
});
it('rolls back the whole nested snapshot on an invalid attachment', async () => {
  const before = await holder.db.repeatOrderTemplate.count();
  const input = fixture(); input.sourcePartId = null as unknown as string;
  input.parts[0].attachments[0].kind = null as unknown as string;
  await expect(createRepeatOrderTemplate(input)).rejects.toThrow();
  expect(await holder.db.repeatOrderTemplate.count()).toBe(before);
});

it('supports Save template and Create again through snapshot then new-order prefill, without duplicate orders', async () => {
  await holder.db.orderPart.create({ data: { id: 'second-part', orderId: 'order', partNumber: 'TEST-2', partName: 'Collar', quantity: 20,
    attachments: { create: { orderId: 'order', kind: 'IMAGE', storagePath: 'synthetic/second.jpg', label: 'second.jpg', mimeType: 'image/jpeg' } } } });
  const ordersBefore = await holder.db.order.count();
  const request = () => new NextRequest('http://local.test/api/repeat-order-templates/from-order/order', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ partId: 'second-part', name: 'Synthetic second template' }),
  });
  const saved = await snapshot(request(), { params: Promise.resolve({ orderId: 'order' }) });
  expect(saved.status).toBe(201);
  const data = await saved.json();
  const again = await snapshot(request(), { params: Promise.resolve({ orderId: 'order' }) });
  expect(again.status).toBe(201);
  expect((await again.json()).template.id).toBe(data.template.id);
  const loaded = await prefill(new Request('http://local.test/api/repeat-order-templates/' + data.template.id), { params: Promise.resolve({ id: data.template.id }) });
  expect(loaded.status).toBe(200);
  const form = (await loaded.json()).template;
  expect(form.parts).toHaveLength(1);
  expect(form.customerId).toBe('customer');
  expect(form.parts[0]).toMatchObject({ partNumber: 'TEST-2', quantity: 20 });
  expect(form.parts[0].attachments[0].storagePath).toBe('synthetic/second.jpg');
  expect(form.attachments).toEqual([]);
  expect(await holder.db.order.count()).toBe(ordersBefore);
});

it('creates repeats for the inherited or explicitly selected customer without changing the template', async () => {
  const input = fixture();
  input.sourcePartId = null as unknown as string;
  const template = await createRepeatOrderTemplate(input);
  await holder.db.customer.create({ data: { id: 'replacement', name: 'Newly added customer' } });
  const submit = (body: object) => createOrder(new NextRequest('http://local.test/api/repeat-order-templates/' + template.id + '/create-order', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: template.id }) });
  const inherited = await submit({ orderNumber: 'CRM-9001' });
  expect(inherited.status).toBe(201);
  expect((await holder.db.order.findUnique({ where: { orderNumber: 'CRM-9001' } }))?.customerId).toBe('customer');
  const replacement = await submit({ orderNumber: 'CRM-9002', customerId: 'replacement' });
  expect(replacement.status).toBe(201);
  expect((await holder.db.order.findUnique({ where: { orderNumber: 'CRM-9002' } }))?.customerId).toBe('replacement');
  expect((await findRepeatOrderTemplateById(template.id))?.customerId).toBe('customer');
  const count = await holder.db.order.count();
  expect((await submit({ customerId: 'missing-customer' })).status).toBe(400);
  expect(await holder.db.order.count()).toBe(count);
});
