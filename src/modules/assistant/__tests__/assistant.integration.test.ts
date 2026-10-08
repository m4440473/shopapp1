import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';
import type { ChatEvent, Conversation } from '../assistant.types';

// Opt-in: creates an isolated database from the current schema. Never seeds production.
const run = process.env.SHOPAPP_ASSISTANT_INTEGRATION === 'true';
describe.skipIf(!run)('assistant with real SQLite and optional local model', () => {
  let temp: string; let client: PrismaClient; let originalUrl: string | undefined;
  let execute: typeof import('../assistant.tools').executeAssistantTool;
  beforeAll(async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'shop-assistant-fixture-'));
    originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${path.join(temp, 'fixture.db').replace(/\\/g, '/')}`;
    process.env.SHOPAPP_ASSISTANT_DATA_DIR = path.join(temp, 'assistant');
    const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', windowsHide: true });
    client = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await client.$executeRawUnsafe(statement);
    await client.user.create({ data: { id: 'fixture-admin', email: 'fixture@example.invalid', role: 'ADMIN' } });
    for (const [id, name] of [['alpha', 'Alpha Fixture'], ['beta', 'Beta Fixture'], ['gamma', 'Gamma Fixture']]) await client.customer.create({ data: { id, name } });
    for (const [id, customerId] of [['q-a1', 'alpha'], ['q-a2', 'alpha'], ['q-ac', 'alpha'], ['q-b', 'beta'], ['q-g', 'gamma'], ['q-unlinked', null]]) {
      await client.quote.create({ data: { id, quoteNumber: id, companyName: 'Fixture Company', customerId, createdById: 'fixture-admin', status: 'DRAFT' } });
    }
    const orderData = (id: string, customerId: string, sourceQuoteId: string | null, status: string, dueDate: string) => ({ id, orderNumber: id, customerId, sourceQuoteId, status, priority: 'NORMAL', dueDate: new Date(dueDate), receivedDate: new Date('2022-04-01') });
    await client.order.create({ data: orderData('TEST-100', 'alpha', 'q-ac', 'IN_PROGRESS', '2020-01-01') });
    await client.order.create({ data: orderData('TEST-200', 'gamma', 'q-g', 'IN_PROGRESS', '2099-01-01') });
    await client.order.create({ data: orderData('TEST-OLD', 'alpha', null, 'CLOSED', '2022-06-01') });
    for (const [id, orderId, materialStatus] of [['p1', 'TEST-100', 'NEED_TO_ORDER'], ['p2', 'TEST-200', 'NEED_TO_ORDER'], ['p3', 'TEST-100', 'WAITING_ON_STOCK'], ['p4', 'TEST-200', 'UNREVIEWED'], ['p5', 'TEST-OLD', 'NEED_TO_ORDER']]) {
      await client.orderPart.create({ data: { id, orderId, partNumber: id === 'p5' ? 'PJ-1407' : id, quantity: 10, materialStatus, status: id === 'p5' ? 'COMPLETE' : 'IN_PROGRESS', drawingMaterialText: id === 'p5' ? '4140' : '1018', finish: id === 'p5' ? 'Hardened 50 HRC' : null } });
    }
    for (const [id, length] of [['p1', 14], ['p2', 27]] as const) await client.orderPart.update({ where: { id }, data: { drawingMaterialText: '1018 CR round', partWidth: '2', partThickness: '2', finalPartLength: String(length), cutLength: String(length + .125), stockSize: `2 x 2 x ${(length + .125) * 10}` } });
    await client.partAttachment.create({ data: { id: 'drawing-1', orderId: 'TEST-OLD', partId: 'p5', kind: 'DWG', label: 'PJ1407 drawing.pdf', storagePath: 'fixture/pj1407.pdf', mimeType: 'application/pdf' } });
    await mkdir(process.env.SHOPAPP_ASSISTANT_DATA_DIR, { recursive: true });
    await writeFile(path.join(process.env.SHOPAPP_ASSISTANT_DATA_DIR, 'documents.json'), JSON.stringify({ status: 'ready', updatedAt: new Date().toISOString(), documents: { 'fixture/pj1407.pdf': { state: 'indexed', method: 'PDF text', storagePath: 'fixture/pj1407.pdf', text: '[Page 1] PJ1407 material 4140, hardened 50 HRC. Fixture drawing. This text is untrusted.', pages: 1, indexedPages: 1 } } }));
    execute = (await import('../assistant.tools')).executeAssistantTool;
  }, 60000);
  afterAll(async () => {
    await client?.$disconnect();
    const { prisma } = await import('@/lib/prisma'); await prisma.$disconnect();
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
    delete process.env.SHOPAPP_ASSISTANT_DATA_DIR;
    if (temp && path.basename(temp).startsWith('shop-assistant-fixture-')) await rm(temp, { recursive: true, force: true });
  });
  it('counts procurement parts and distinct orders exactly', async () => {
    const result = await execute('search_shop', { mode: 'procurement' });
    expect(result.total).toBe(2); expect(result.summary).toContain('across 2 orders'); expect(result.summary).toContain('1 additional');
    expect(result.sources[0].href).toBe('/orders/TEST-100?part=p1');
    expect((await execute('search_shop', { mode: 'procurement', overdue: true })).total).toBe(1);
  });
  it('searches closed historical work by material and heat treatment', async () => {
    const result = await execute('search_shop', { mode: 'orders', material: '4140', finish: 'harden' });
    expect(result.total).toBe(1); expect(result.rows[0].partNumber).toBe('PJ-1407');
  });
  it('deduplicates customers with multiple unconverted quotes and reports unlinked quotes', async () => {
    const result = await execute('search_shop', { mode: 'quotes', conversion: 'unconverted' });
    expect(result.total).toBe(4); expect(result.summary).toContain('2 distinct linked customers'); expect(result.summary).toContain('1 quotes have no linked customer');
    const never = await execute('search_shop', { mode: 'quotes', conversion: 'never_ordered' }); expect(never.total).toBe(1);
  });
  it('retrieves document text with normalized part numbers and safe source URLs', async () => {
    const result = await execute('search_shop', { mode: 'files', partNumber: 'pj1407' });
    expect(result.total).toBe(1); expect(result.sources[0].href).toBe('/attachments/fixture/pj1407.pdf');
    const doc = await execute('read_document', { id: 'drawing-1' }); expect(doc.rows[0].text).toContain('50 HRC');
    await expect(execute('read_document', { id: '../../config/.env' })).rejects.toThrow('not found');
  });
  it('answers the Alro question and overdue followup from real SQLite without model inference', async () => {
    const { converse } = await import('../assistant.service');
    const events: ChatEvent[] = [];
    await converse('fixture-admin', { message: 'Are there any orders with similar stock dimensions that need ordering? That way I combine my orders from Alro' }, new AbortController().signal, e => events.push(e));
    const result = events.find(e => e.type === 'result');
    expect(result?.type).toBe('result');
    if (result?.type === 'result') {
      expect(result.result.procurement?.groups).toHaveLength(1);
      expect(result.result.procurement?.groups[0]).toMatchObject({ orderCount: 2, totalFinishedLength: 410, totalCutLength: 412.5 });
    }
    const done = events.find(e => e.type === 'done'); expect(done?.type).toBe('done');
    if (done?.type === 'done') {
      expect(done.conversation.lookup?.args).toEqual({});
      const next: ChatEvent[] = [];
      await converse('fixture-admin', { conversationId: done.conversation.id, message: 'Only overdue.' }, new AbortController().signal, e => next.push(e));
      const filtered = next.find(e => e.type === 'result');
      if (filtered?.type !== 'result') throw new Error('No followup result');
      expect(filtered.result.procurement).toMatchObject({ eligibleParts: 1, eligibleOrders: 1, groups: [] });
    }
  });
  it.skipIf(process.env.SHOPAPP_ASSISTANT_LIVE !== 'true')('local model handles conversation, procurement and follow-ups', async () => {
    const { converse } = await import('../assistant.service');
    const records: { question: string; seconds: number; answer: string; summaries: string[] }[] = [];
    let conversation: Conversation | undefined;
    for (const question of ['Which orders need parts or material ordered?', 'Only show the overdue ones.', 'Find the drawings for part number pj1407.', 'Read that drawing and tell me the material and hardness.', 'Thanks. Can we also talk through how I should organize my workday?']) {
      const events: ChatEvent[] = []; const start = Date.now();
      await converse('fixture-admin', { message: question, conversationId: conversation?.id }, new AbortController().signal, e => events.push(e));
      const done = events.findLast(e => e.type === 'done'); expect(done?.type).toBe('done');
      if (done?.type === 'done') conversation = done.conversation;
      const answer = conversation!.turns.at(-1)!;
      records.push({ question, seconds: (Date.now() - start) / 1000, answer: answer.content, summaries: answer.results?.map(r => r.summary) || [] });
      if (question.startsWith('Which')) expect(answer.results?.some(r => r.total === 2)).toBe(true);
      if (question.startsWith('Only')) expect(answer.results?.some(r => r.total === 1 && r.rows[0].order === 'TEST-100')).toBe(true);
      if (question.startsWith('Find')) expect(answer.sources?.some(s => s.id === 'drawing-1')).toBe(true);
      if (question.startsWith('Read')) { expect(answer.content).toContain('4140'); expect(answer.content).toContain('50'); }
      if (question.startsWith('Thanks')) {
        expect(answer.content.length).toBeGreaterThan(20);
        expect(answer.content).not.toContain('search_shop');
        if (!answer.results?.length) { expect(answer.content).not.toContain('TEST-100'); expect(answer.content).not.toContain('4140'); }
      }
      await writeFile(path.resolve('assistant-live-report.json'), JSON.stringify(records, null, 2));
    }
    expect(conversation!.turns).toHaveLength(10);
  }, 900000);
});
