import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  db: null as unknown as PrismaClient, root: '', parse: vi.fn(), authorized: true,
  count: vi.fn(async () => ({ input_tokens: 100 })),
}));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = runtime.db[String(key)];
  return typeof value === 'function' ? value.bind(runtime.db) : value;
} }) }));
vi.mock('@/lib/app-settings', () => ({ getAppSettings: async () => ({ attachmentsDir: runtime.root }) }));
vi.mock('openai', () => ({ default: class { responses = { parse: runtime.parse, inputTokens: { count: runtime.count } }; } }));
vi.mock('@/lib/auth-session', () => ({ getServerAuthSession: async () => runtime.authorized ? { user: { role: 'ADMIN' } } : null }));
vi.mock('@/lib/rbac', () => ({ canAccessAdmin: () => true }));

import { extractLocalDrawingFields } from '../local/drawing-import-local';
import { ensureQuoteDrawingImportV2JobProcessing, getQuoteDrawingImportV2JobSnapshot, saveQuoteDrawingImportV2Classification, saveQuoteDrawingImportV2FieldCorrection } from '../drawing-import-v2.service';
import { recordHumanDrawingImportCorrection, updateDrawingImportPageLocalAnalysis, updateDrawingImportPageResult } from '../drawing-import-v2.repo';
import type { DrawingImportPageExtraction } from '../drawing-import-v2.types';
import { DRAWING_IMPORT_FIELD_NAMES } from '../drawing-import-v2.types';
import { createFileOnlyDrawingExtraction } from '../drawing-import-review';
import { GET, PATCH } from '@/app/api/admin/quotes/drawing-import-v2/[jobId]/route';

const blankText = { pageNumber: 1, pageWidth: 612, pageHeight: 792, pageRotation: 0, rawText: '', spans: [], lines: [], extractionMethod: 'embedded_text' as const };
function response() {
  const field = (value: string | number | boolean | null) => ({ value, rawText: value == null ? null : String(value),
    status: value == null ? 'not_present' : 'read', evidenceText: value == null ? null : String(value),
    sourceRegionIdentity: null, warnings: [], diagnosticConfidence: 0.9 });
  return { status: 'completed', output: [], id: randomUUID(), usage: { input_tokens: 100, output_tokens: 100 }, output_parsed: {
    classification: 'part_drawing', classificationEvidenceText: 'Part drawing', partNumber: field('AI-100'),
    partName: field('Model name'), drawingQuantity: field(2), material: field('Model material'), finish: field(null),
    stockSize: field(null), cutLength: field(null), finalLength: field('4'), partWidth: field('2'),
    partThickness: field('1'), revision: field(null), assemblyStatus: field(false), manufacturingNotes: [], contradictions: [], warnings: [],
  } };
}

beforeAll(async () => {
  runtime.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-review-races-'));
  await writeFile(path.join(runtime.root, 'test.db'), '');
  const url = `file:${path.join(runtime.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
  const doc = await PDFDocument.create(); doc.addPage([612, 792]);
  await writeFile(path.join(runtime.root, 'source.pdf'), await doc.save());
  await writeFile(path.join(runtime.root, 'preview.png'), await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer());
}, 60000);
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-a-real-key');
  vi.stubEnv('DRAWING_IMPORT_V3_ENABLED', 'true');
  runtime.parse.mockReset().mockImplementation(async () => response());
  runtime.authorized = true;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await runtime.db?.$disconnect();
  if (path.dirname(runtime.root) === path.resolve(os.tmpdir()) && path.basename(runtime.root).startsWith('shopapp-review-races-')) {
    await rm(runtime.root, { recursive: true, force: true });
  }
});

async function fixture() {
  const job = await runtime.db.drawingImportJob.create({ data: {
    idempotencyKey: randomUUID(), destination: 'order', business: 'STD', customerName: 'Synthetic race test',
    draftReference: 'REVIEW-RACE', intakeMode: 'ASSEMBLY', assemblyMultiplier: 3,
    pipelineVersion: 'test', mode: 'admin_beta', configJson: '{}', softBudgetUsd: 5, hardBudgetUsd: 8,
    status: 'READY_FOR_REVIEW', stage: 'ready_for_review',
  } });
  const source = await runtime.db.drawingImportSource.create({ data: {
    jobId: job.id, sourceKind: 'drawing', originalFilename: 'source.pdf', mimeType: 'application/pdf',
    sizeBytes: 1, sha256: randomUUID(), storagePath: 'source.pdf', pageCount: 1,
  } });
  const pageId = randomUUID();
  const extraction = extractLocalDrawingFields({ pageId, filename: 'source.pdf', page: blankText }).extraction;
  extraction.classification = 'part_drawing';
  await runtime.db.drawingImportPage.create({ data: {
    id: pageId, jobId: job.id, sourceId: source.id, sourcePageNumber: 1, sourceFilename: 'source.pdf',
    contentSha256: randomUUID(), width: 612, height: 792, canonicalPdfStoragePath: 'source.pdf', previewStoragePath: 'preview.png',
    classification: extraction.classification, reviewStatus: 'MANUAL_REVIEW', localExtractionJson: JSON.stringify(extraction),
    finalExtractionJson: JSON.stringify(extraction),
  } });
  return { jobId: job.id as string, pageId, extraction };
}
async function read(pageId: string) {
  const row = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: pageId } });
  return { row, extraction: JSON.parse(row.finalExtractionJson!) as DrawingImportPageExtraction };
}
async function waitForJob(jobId: string) {
  await vi.waitFor(async () => {
    const job = await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(['READY_FOR_REVIEW', 'PARTIAL_FAILURE']).toContain(job.status);
  }, { timeout: 15000, interval: 50 });
}

describe('atomic human review writes on SQLite', () => {
  it('keeps a failed page as a file without extracted facts, filename guesses, or another AI request', async () => {
    const f = await fixture();
    await runtime.db.drawingImportJob.update({ where: { id: f.jobId }, data: { status: 'FAILED' } });
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: {
      sourceFilename: 'MAT-6061-QTY-99-REV-C.pdf', classification: 'uncertain', reviewStatus: 'FAILED',
      localExtractionJson: null, finalExtractionJson: null,
    } });
    const result = await saveQuoteDrawingImportV2Classification({ jobId: f.jobId, pageId: f.pageId, classification: 'reference' });
    const saved = await read(f.pageId);
    expect(result).toMatchObject({ classification: 'reference', canonicalSource: { storagePath: 'source.pdf' }, originalPacketSource: { storagePath: 'source.pdf' } });
    for (const field of DRAWING_IMPORT_FIELD_NAMES) expect(saved.extraction[field]).toMatchObject({ value: null, status: 'unreadable', evidence: [], candidates: [] });
    expect(saved.extraction.manufacturingNotes).toEqual([]);
    expect(saved.extraction.autoAcceptedFields).toEqual([]);
    expect(saved.extraction.classificationEvidence).toEqual([expect.objectContaining({ sourceType: 'human', sourcePageId: f.pageId, rawText: 'reference' })]);
    const audit = await runtime.db.drawingExtractionAttempt.findMany({ where: { pageId: f.pageId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ sourceType: 'human', status: 'completed', resultJson: saved.row.finalExtractionJson });
    expect((await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: f.jobId } })).status).toBe('FAILED');
    expect(runtime.parse).not.toHaveBeenCalled();
  });

  it('still rejects part classification and field corrections without an extraction', async () => {
    const f = await fixture();
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: { localExtractionJson: null, finalExtractionJson: null, classification: 'uncertain' } });
    await expect(saveQuoteDrawingImportV2Classification({ jobId: f.jobId, pageId: f.pageId, classification: 'part_drawing' })).rejects.toThrow('reviewable extraction');
    await expect(saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'partNumber', value: 'UNKNOWN' })).rejects.toThrow('reviewable extraction');
    expect(await runtime.db.drawingExtractionAttempt.count({ where: { pageId: f.pageId } })).toBe(0);
    expect(runtime.parse).not.toHaveBeenCalled();
  });

  it('does not copy caller-supplied fact values into the null-extraction file-only fallback', async () => {
    const f = await fixture();
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: { localExtractionJson: null, finalExtractionJson: null } });
    const patch = createFileOnlyDrawingExtraction(f.pageId);
    patch.partNumber.value = 'DO NOT INFER';
    await recordHumanDrawingImportCorrection({ pageId: f.pageId, extraction: patch, field: 'classification', idempotencyKey: randomUUID() });
    expect((await read(f.pageId)).extraction.partNumber.value).toBeNull();
  });

  it('rolls back a null-extraction file-only decision if its audit insert fails', async () => {
    const f = await fixture();
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: { localExtractionJson: null, finalExtractionJson: null, classification: 'uncertain' } });
    const idempotencyKey = randomUUID();
    await runtime.db.drawingExtractionAttempt.create({ data: { pageId: f.pageId, stage: 'human_review', sourceType: 'human', routeTier: 'human', idempotencyKey, status: 'completed' } });
    await expect(recordHumanDrawingImportCorrection({ pageId: f.pageId, extraction: createFileOnlyDrawingExtraction(f.pageId), field: 'classification', idempotencyKey })).rejects.toThrow();
    const saved = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.pageId } });
    expect(saved).toMatchObject({ finalExtractionJson: null, classification: 'uncertain' });
    expect(await runtime.db.drawingExtractionAttempt.count({ where: { pageId: f.pageId } })).toBe(1);
  });

  it('persists simultaneous PATCH requests and returns current GET state without triggering another model call', async () => {
    const f = await fixture();
    const context = { params: Promise.resolve({ jobId: f.jobId }) };
    const url = `http://localhost/api/admin/quotes/drawing-import-v2/${f.jobId}`;
    const patch = (body: object) => PATCH(new NextRequest(url, { method: 'PATCH', body: JSON.stringify(body) }), context);
    const responses = await Promise.all([
      patch({ pageId: f.pageId, field: 'material', value: 'Route material' }),
      patch({ pageId: f.pageId, field: 'partName', value: 'Route name' }),
      patch({ pageId: f.pageId, kind: 'classification', classification: 'assembly_drawing' }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    const snapshot = await (await GET(new NextRequest(url), context)).json();
    expect(snapshot.pages[0]).toMatchObject({ classification: 'assembly_drawing', extraction: {
      material: { value: 'Route material' }, partName: { value: 'Route name' },
    } });
    expect((await patch({ pageId: f.pageId, field: 'drawingQuantity', value: 0 })).status).toBe(400);
    expect((await patch({ pageId: 'another-page', field: 'material', value: 'No' })).status).toBe(400);
    runtime.authorized = false;
    expect((await patch({ pageId: f.pageId, field: 'material', value: 'No access' })).status).toBe(403);
    expect((await read(f.pageId)).extraction.material.value).toBe('Route material');
    expect(runtime.parse).not.toHaveBeenCalled();
  });

  it('retains all concurrent field patches instead of replacing unrelated fields from stale extraction copies', async () => {
    const f = await fixture();
    const values = { partName: 'Confirmed name', material: 'Confirmed material', finish: 'Black oxide',
      stockSize: '2 x 3', cutLength: '8', finalLength: '7.5', partWidth: '2', partThickness: '1', revision: 'C' };
    await Promise.all(Object.entries(values).map(([field, value]) => saveQuoteDrawingImportV2FieldCorrection({
      jobId: f.jobId, pageId: f.pageId, field: field as keyof typeof values, value,
    })));
    const saved = await read(f.pageId);
    for (const [field, value] of Object.entries(values)) expect(saved.extraction[field]).toMatchObject({ value, status: 'human_corrected' });
    expect(saved.row.reviewStatus).toBe('MANUAL_REVIEW');
    expect(await runtime.db.drawingExtractionAttempt.count({ where: { pageId: f.pageId, sourceType: 'human' } })).toBe(9);
  });

  it('preserves a newer same-field correction over delayed AI and packet-finalization writes', async () => {
    const f = await fixture();
    const background = structuredClone(f.extraction);
    background.material = { ...background.material, value: 'AI material', status: 'read' };
    await saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'material', value: 'First confirmation' });
    await Promise.all([
      updateDrawingImportPageResult({ pageId: f.pageId, extraction: background, reviewStatus: 'ACCEPTED', routeTier: 'terra_full_page' }),
      saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'material', value: 'Latest confirmation' }),
    ]);
    await updateDrawingImportPageResult({ pageId: f.pageId, extraction: background, reviewStatus: 'ACCEPTED', routeTier: 'terra_full_page' });
    expect((await read(f.pageId)).extraction.material).toMatchObject({ value: 'Latest confirmation', status: 'human_corrected' });
  });

  it('commits human classification and its evidence atomically and protects them from model/local guesses', async () => {
    const f = await fixture();
    await Promise.all([
      saveQuoteDrawingImportV2Classification({ jobId: f.jobId, pageId: f.pageId, classification: 'reference' }),
      saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'partName', value: 'Keep this' }),
    ]);
    await updateDrawingImportPageResult({ pageId: f.pageId, extraction: f.extraction, reviewStatus: 'ACCEPTED', routeTier: 'terra_full_page' });
    await updateDrawingImportPageLocalAnalysis({ pageId: f.pageId, extraction: f.extraction, classification: 'part_drawing', classificationConfidence: 1 });
    const saved = await read(f.pageId);
    expect(saved.row.classification).toBe('reference');
    expect(saved.extraction.classification).toBe('reference');
    expect(saved.extraction.classificationEvidence[0].sourceType).toBe('human');
    expect(saved.extraction.partName.value).toBe('Keep this');
    await runtime.db.drawingImportJob.update({ where: { id: f.jobId }, data: {
      countsJson: JSON.stringify({ totalPages: 1, completedPages: 0, manualReviewPages: 1, failedPages: 1 }),
    } });
    expect((await getQuoteDrawingImportV2JobSnapshot(f.jobId)).progress).toMatchObject({
      completedPages: 1, manualReviewPages: 0, failedPages: 0,
    });
  });

  it('rolls back a page change when its audit cannot be committed', async () => {
    const f = await fixture();
    const patch = structuredClone(f.extraction);
    patch.material = { ...patch.material, value: 'Recorded once', status: 'human_corrected' };
    const input = { pageId: f.pageId, field: 'material' as const, extraction: patch, idempotencyKey: randomUUID() };
    await recordHumanDrawingImportCorrection(input);
    patch.material.value = 'Must roll back';
    await expect(recordHumanDrawingImportCorrection(input)).rejects.toThrow();
    expect((await read(f.pageId)).extraction.material.value).toBe('Recorded once');
  });
});

describe('ordinary import AI and finalization race (real SQLite, mocked AI)', () => {
  it('keeps in-flight field/classification confirmations through the first AI result and final quantity multiplication', async () => {
    const f = await fixture();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    runtime.parse.mockImplementation(async () => { await gate; return response(); });
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: { reviewStatus: 'PENDING' } });
    await runtime.db.drawingImportJob.update({ where: { id: f.jobId }, data: { status: 'QUEUED', countsJson: null } });
    ensureQuoteDrawingImportV2JobProcessing(f.jobId);
    await vi.waitFor(() => expect(runtime.parse).toHaveBeenCalledTimes(1));
    try {
      await Promise.all([
        saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'drawingQuantity', value: 17 }),
        saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'material', value: 'Human material' }),
        saveQuoteDrawingImportV2Classification({ jobId: f.jobId, pageId: f.pageId, classification: 'assembly_drawing' }),
      ]);
      const snapshot = await getQuoteDrawingImportV2JobSnapshot(f.jobId);
      expect(snapshot.pages[0].processingStatus).toBe('processing');
      expect(snapshot.progress.completedPages).toBe(0);
    } finally { finish(); }
    await waitForJob(f.jobId);
    const saved = await read(f.pageId);
    expect(saved.row.classification).toBe('assembly_drawing');
    expect(saved.extraction.partNumber.value).toBe('AI-100');
    expect(saved.extraction.material).toMatchObject({ value: 'Human material', status: 'human_corrected' });
    expect(saved.extraction.drawingQuantity).toMatchObject({ value: 17, status: 'human_corrected' });
    expect(runtime.parse).toHaveBeenCalledTimes(1);
    const snapshot = await getQuoteDrawingImportV2JobSnapshot(f.jobId);
    expect(snapshot.progress).toMatchObject({ status: 'READY_FOR_REVIEW', completedPages: 1, failedPages: 0 });
    expect(snapshot.pages[0].processingStatus).toBe('ready');
  });

  it('reports failed first model requests as a page failure without retrying or erasing saved confirmations', async () => {
    const f = await fixture();
    await saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.pageId, field: 'material', value: 'Keep on failure' });
    runtime.parse.mockRejectedValue(Object.assign(new Error('Synthetic unavailable'), { status: 503 }));
    await runtime.db.drawingImportPage.update({ where: { id: f.pageId }, data: { reviewStatus: 'PENDING' } });
    await runtime.db.drawingImportJob.update({ where: { id: f.jobId }, data: { status: 'QUEUED', countsJson: null } });
    ensureQuoteDrawingImportV2JobProcessing(f.jobId);
    await waitForJob(f.jobId);
    expect(runtime.parse).toHaveBeenCalledTimes(1);
    const snapshot = await getQuoteDrawingImportV2JobSnapshot(f.jobId);
    expect(snapshot.progress).toMatchObject({ status: 'PARTIAL_FAILURE', failedPages: 1 });
    expect(snapshot.pages[0].processingStatus).toBe('failed');
    expect((await read(f.pageId)).extraction.material.value).toBe('Keep on failure');
  });
});
