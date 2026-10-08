import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = runtime.db[String(key)];
  return typeof value === 'function' ? value.bind(runtime.db) : value;
} }) }));
vi.mock('@/repos/orders', async () => ({
  ...await import('../orders.create.repo'),
  listAddonsByIds: async () => [],
  listDepartmentsOrdered: async () => [],
}));
vi.mock('@/modules/customers/customers.service', () => ({ resolveCustomerContactSnapshot: async () => null }));
vi.mock('../orders.files.service', () => ({ ensureOrderFilesInCanonicalStorage: async () => ({ ok: true }) }));

import { generateNextOrderNumber } from '../orders.create.repo';
import { createOrderFromPayload } from '../orders.create.service';
import { OrderCreate } from '../orders.schema';

let temporaryRoot: string;
beforeAll(async () => {
  temporaryRoot = mkdtempSync(path.join(tmpdir(), 'shopapp-order-number-'));
  const databasePath = path.join(temporaryRoot, 'test.db');
  writeFileSync(databasePath, '');
  const url = `file:${databasePath.replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
  await runtime.db.customer.create({ data: { id: 'number-customer', name: 'Synthetic Numbering Customer' } });
}, 60000);

beforeEach(async () => {
  await runtime.db.statusHistory.deleteMany();
  await runtime.db.orderPart.deleteMany();
  await runtime.db.order.deleteMany();
});
afterAll(async () => {
  await runtime.db?.$disconnect();
  if (!temporaryRoot) return;
  const resolved = path.resolve(temporaryRoot);
  if (!resolved.startsWith(`${path.resolve(tmpdir())}${path.sep}`) || !path.basename(resolved).startsWith('shopapp-order-number-')) {
    throw new Error('Refusing to remove a directory outside this test fixture.');
  }
  rmSync(resolved, { recursive: true, force: true });
});

function existingOrder(orderNumber: string, business: string) {
  return {
    orderNumber, business, customerId: 'number-customer', status: 'RECEIVED', priority: 'NORMAL',
    receivedDate: new Date('2026-09-10'), dueDate: new Date('2026-09-17'),
  };
}

function payload(orderNumber?: string) {
  return OrderCreate.parse({
    business: 'STD', customerId: 'number-customer', orderNumber,
    receivedDate: '2026-09-10', dueDate: '2026-09-17',
    parts: [{ partNumber: 'SYNTHETIC-1', quantity: 2 }],
  });
}

describe('order number allocation against real SQLite', () => {
  it('reserves an existing prefix after its order changes business and creates the next order with its parts', async () => {
    await runtime.db.order.createMany({ data: [existingOrder('STD-1002', 'STD'), existingOrder('STD-1003', 'CRM')] });
    expect(await generateNextOrderNumber('STD')).toBe('STD-1004');
    const result = await createOrderFromPayload(payload());
    expect(result.ok).toBe(true);
    const created = await runtime.db.order.findUnique({ where: { orderNumber: 'STD-1004' }, include: { parts: true } });
    expect(created).toMatchObject({ business: 'STD', customerId: 'number-customer' });
    expect(created?.parts).toHaveLength(1);
    expect(created?.parts[0]).toMatchObject({ partNumber: 'SYNTHETIC-1', quantity: 2 });
    expect(await runtime.db.order.count()).toBe(3);
    expect(await runtime.db.order.findUnique({ where: { orderNumber: 'STD-1003' } })).toMatchObject({ business: 'CRM' });
  });

  it('finds numeric maxima beyond the former 200 text-sorted rows and across digit widths', async () => {
    const data = Array.from({ length: 201 }, (_, index) => existingOrder(`PC-${9799 + index}`, 'PC'));
    data.push(existingOrder('PC-10000', 'CRM'));
    await runtime.db.order.createMany({ data });
    expect(await generateNextOrderNumber('PC')).toBe('PC-10001');
  });

  it('uses only exact numeric suffixes of the requested prefix', async () => {
    await runtime.db.order.createMany({ data: [
      existingOrder('STD-1002', 'CRM'), existingOrder('CRM-99999', 'STD'),
      existingOrder('STD-2026-09-10', 'STD'), existingOrder('STD-8888-REV22', 'STD'),
    ] });
    expect(await generateNextOrderNumber('STD')).toBe('STD-1003');
    expect(await generateNextOrderNumber('PC')).toBe('PC-1001');
  });

  it('returns an explicit conflict without committing another order or any parts', async () => {
    await runtime.db.order.create({ data: existingOrder('STD-1003', 'CRM') });
    const result = await createOrderFromPayload(payload('STD-1003'));
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(await runtime.db.order.count()).toBe(1);
    expect(await runtime.db.orderPart.count()).toBe(0);
  });
});
