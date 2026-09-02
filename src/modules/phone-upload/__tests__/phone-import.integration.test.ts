import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient, root: '', calls: [] as any[], auth: true }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => { const value = holder.db[String(key)]; return typeof value === 'function' ? value.bind(holder.db) : value; } }) }));
vi.mock('@/lib/app-settings', () => ({ getAppSettings: async () => ({ attachmentsDir: path.join(holder.root, 'storage') }) }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: async () => holder.auth ? ({ user: { id: 'admin', role: 'ADMIN' } }) : null }));
vi.mock('openai', () => ({ default: class {
  responses = {
    inputTokens: { count: async () => ({ input_tokens: 1000 }) },
    parse: async (body: any) => {
      holder.calls.push(body);
      return { id: 'synthetic-response', model: 'gpt-5.6-terra', status: 'completed', service_tier: 'default', output: [], output_parsed: {
        partNumber: 'PHONE-101', description: 'Spacer', drawingQuantity: 2,
        material: '1018 Steel', finish: 'None', finalLength: 4,
        partWidth: 2, partThickness: 0.25, revision: null,
      }, usage: { input_tokens: 1000, output_tokens: 200 } };
    },
  };
} }));
import { POST as create } from '@/app/api/admin/phone-upload/route';
import { POST as photo, PATCH as finish } from '@/app/api/phone-upload/[id]/route';
import { POST as claim } from '@/app/api/admin/phone-upload/[id]/route';
import { getQuoteDrawingImportV2JobSnapshot } from '@/modules/drawing-import/v2/drawing-import-v2.service';
import { buildReviewedQuoteDrawingImport } from '@/components/orders/drawing-import/quote-drawing-import';
import { OrderPartCreate } from '@/modules/orders/orders.schema';
beforeAll(async () => {
  holder.root = mkdtempSync(path.join(tmpdir(), 'phone-import-integration-'));
  writeFileSync(path.join(holder.root, 'test.db'), '');
  const url = `file:${path.join(holder.root, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js','db','push','--skip-generate','--schema','prisma/schema.prisma'], { env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe' });
  holder.db = new PrismaClient({ datasources: { db: { url } } });
  await holder.db.user.create({ data: { id: 'admin', email: 'synthetic@example.test', role: 'ADMIN' } });
  for (const [key,value] of Object.entries({ PHONE_UPLOAD_DIR: path.join(holder.root,'phone'), PHONE_UPLOAD_PUBLIC_ORIGIN:'http://local.test', DRAWING_IMPORT_V2_MODE:'admin_beta', DRAWING_IMPORT_V3_ENABLED:'true', DRAWING_IMPORT_V2_SOL:'false', DRAWING_IMPORT_V2_OCR:'false', OPENAI_API_KEY:'synthetic-not-a-real-key' })) vi.stubEnv(key,value);
}, 60000);
afterAll(async () => { await holder.db?.$disconnect(); vi.unstubAllEnvs(); rmSync(holder.root,{recursive:true,force:true}); });
it('requires desktop authentication to create upload sessions', async () => {
  holder.auth = false;
  const response = await create(new Request('http://local.test/api/admin/phone-upload', { method:'POST',body:'{}' }));
  expect(response.status).toBe(401); holder.auth = true;
});
it.each(['quote','order'] as const)('imports phone photos through real %s routes, canonical PDFs and review mapping', async destination => {
  holder.calls.length = 0;
  const input = { destination, business:'Sterling Tool and Die',customerName:'Synthetic Customer',draftReference:`SYN-${destination}`,intakeMode:'ONE_OFF',assemblyMultiplier:1 };
  const created = await create(new Request('http://local.test/api/admin/phone-upload',{ method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input) }));
  expect(created.status).toBe(200);
  const session = await created.json(); const params = { params:Promise.resolve({id:session.id}) }; const token = session.url.split('#')[1];
  const bytes = await sharp({ create: { width:800,height:600,channels:3,background:destination==='quote'?'white':'#eeeeee' } }).jpeg().toBuffer();
  const uploaded = await photo(new Request('http://local.test/api/phone-upload/'+session.id,{method:'POST',headers:{'content-type':'image/jpeg','x-phone-upload-token':token,'x-photo-filename':'drawing.jpg','x-photo-id':'test-photo-request-001'},body:new Uint8Array(bytes)}),params);
  expect(uploaded.status).toBe(200);
  expect((await finish(new Request('http://local.test/api/phone-upload/'+session.id,{method:'PATCH',headers:{'x-phone-upload-token':token}}),params)).status).toBe(200);
  const claimed = await claim(new Request('http://local.test/api/admin/phone-upload/'+session.id,{method:'POST',body:JSON.stringify(input)}),params);
  expect(claimed.status).toBe(200);
  let snapshot = await claimed.json();
  const deadline = Date.now()+40000;
  while (['QUEUED','PROCESSING'].includes(snapshot.progress.status) && Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,100));
    snapshot = await getQuoteDrawingImportV2JobSnapshot(snapshot.progress.jobId);
  }
  expect(snapshot.progress.status).toBe('READY_FOR_REVIEW');
  expect(snapshot.pages).toHaveLength(1);
  expect(snapshot.pages[0].canonicalSource.mimeType).toBe('application/pdf');
  const stored = path.join(holder.root,'storage',snapshot.pages[0].canonicalSource.storagePath);
  expect(readFileSync(stored).subarray(0,4).toString()).toBe('%PDF');
  expect((await holder.db.drawingImportJob.findUnique({where:{id:snapshot.progress.jobId}})).destination).toBe(destination);
  expect(holder.calls).toHaveLength(1);
  expect(JSON.stringify(holder.calls[0])).toContain('input_image');
  const review = buildReviewedQuoteDrawingImport(snapshot.pages,[{id:'steel',name:'1018 Steel'}],snapshot.supportingFiles);
  expect(review.blockingMessages).toEqual([]);
  expect(review.parts[0]).toMatchObject({partNumber:'PHONE-101',quantity:2,cutLength:'4.125',finalPartLength:'4',materialId:'steel'});
  expect(OrderPartCreate.parse(review.parts[0])).toMatchObject({finalPartLength:'4',drawingMaterialText:'1018 Steel'});
},60000);
