import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  db: null as unknown as PrismaClient,
  root: '',
  parse: vi.fn(),
  count: vi.fn(async () => ({ input_tokens: 100 })),
}));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = runtime.db[String(key)];
  return typeof value === 'function' ? value.bind(runtime.db) : value;
} }) }));
vi.mock('@/lib/app-settings', () => ({
  getAppSettings: async () => ({ attachmentsDir: runtime.root, drawingImportLunaFallbackEnabled: true }),
}));
vi.mock('openai', () => ({ default: class {
  responses = { parse: runtime.parse, inputTokens: { count: runtime.count } };
} }));

import * as documentTools from '../document';
import { extractLocalDrawingFields } from '../local/drawing-import-local';
import { ensureQuoteDrawingImportV2JobProcessing, reprocessQuoteDrawingImportV2Page, saveQuoteDrawingImportV2FieldCorrection } from '../drawing-import-v2.service';
import { queueDrawingImportPageReprocess } from '../drawing-import-v2.repo';
import { getDrawingImportV2Config } from '../drawing-import-v2.config';

let pdf: Buffer;
const blankText = { pageNumber: 1, pageWidth: 612, pageHeight: 792, pageRotation: 0, rawText: '', spans: [], lines: [], extractionMethod: 'embedded_text' as const };
function response() {
  const modelField = (value: string | number | boolean | null) => ({
    value, rawText: value == null ? null : String(value), status: value == null ? 'not_present' : 'read',
    evidenceText: value == null ? null : String(value), sourceRegionIdentity: null, warnings: [], diagnosticConfidence: 0.9,
  });
  return {
    status: 'completed', output: [], id: 'synthetic-response',
    usage: { input_tokens: 100, output_tokens: 100 },
    output_parsed: {
      classification: 'part_drawing', classificationEvidenceText: 'Single page',
      partNumber: modelField('FRESH-200'), partName: modelField('Fresh name'), drawingQuantity: modelField(2),
      material: modelField('4140'), finish: modelField(null), stockSize: modelField(null),
      cutLength: modelField(null), finalLength: modelField('4'), partWidth: modelField('1'), partThickness: modelField(null),
      revision: modelField(null), assemblyStatus: modelField(false), manufacturingNotes: [], contradictions: [], warnings: [],
    },
  };
}

beforeAll(async () => {
  runtime.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-page-reprocess-'));
  await writeFile(path.join(runtime.root, 'test.db'), '');
  const url = `file:${path.join(runtime.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  pdf = Buffer.from(await doc.save());
  await writeFile(path.join(runtime.root, 'selected.pdf'), pdf);
  await writeFile(path.join(runtime.root, 'preview.png'), await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer());
  vi.spyOn(documentTools, 'createOcrEngine').mockImplementation(() => { throw new Error('OCR must not run'); });
}, 60000);

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-a-real-key');
  vi.stubEnv('DRAWING_IMPORT_V3_ENABLED', 'true');
  vi.stubEnv('DRAWING_IMPORT_V2_OCR', 'true');
  vi.stubEnv('DRAWING_IMPORT_V2_RETRY_LIMIT', '5');
  runtime.parse.mockReset().mockImplementation(async () => response());
  runtime.count.mockClear();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await runtime.db?.$disconnect();
  if (path.dirname(runtime.root) === path.resolve(os.tmpdir()) && path.basename(runtime.root).startsWith('shopapp-page-reprocess-')) {
    await rm(runtime.root, { recursive: true, force: true });
  }
});

async function fixture(assembly = false, classification = 'part_drawing') {
  const job = await runtime.db.drawingImportJob.create({ data: {
    idempotencyKey: crypto.randomUUID(), destination: 'quote', business: 'STD', customerName: 'Synthetic retry test',
    draftReference: 'PAGE-RETRY', intakeMode: assembly ? 'ASSEMBLY' : 'ONE_OFF', assemblyMultiplier: 3,
    pipelineVersion: 'test', mode: 'admin_beta', configJson: '{}', softBudgetUsd: 5, hardBudgetUsd: 8,
    status: 'READY_FOR_REVIEW', stage: 'ready_for_review',
  } });
  const source = await runtime.db.drawingImportSource.create({ data: {
    jobId: job.id, sourceKind: 'archive_drawing', originalFilename: 'assembly.pdf', archivePath: 'nested/assembly.pdf',
    mimeType: 'application/pdf', sizeBytes: 123, sha256: 'source', storagePath: 'original-must-not-be-read.pdf', pageCount: 2,
  } });
  const otherSource = await runtime.db.drawingImportSource.create({ data: {
    jobId: job.id, sourceKind: 'archive_drawing', originalFilename: 'detail.pdf', archivePath: 'other/detail.pdf',
    mimeType: 'application/pdf', sizeBytes: 123, sha256: 'other-source', storagePath: 'other-must-not-be-read.pdf', pageCount: 1,
  } });
  const ids: string[] = [];
  for (let index = 0; index < 3; index++) {
    const id = crypto.randomUUID();
    ids.push(id);
    const local = extractLocalDrawingFields({ pageId: id, filename: 'assembly.pdf', page: blankText }).extraction;
    local.partNumber = { ...local.partNumber, value: 'STALE-OCR-GUESS', rawText: 'STALE-OCR-GUESS', status: 'read' };
    local.classification = classification as typeof local.classification;
    const previous = structuredClone(local);
    previous.partName = { ...previous.partName, value: 'Human confirmed name', status: 'human_corrected' };
    previous.drawingQuantity = { ...previous.drawingQuantity, value: assembly ? 12 : 4, status: assembly ? 'derived_locally' : 'read' };
    await runtime.db.drawingImportPage.create({ data: {
      id, jobId: job.id, sourceId: index === 2 ? otherSource.id : source.id,
      sourcePageNumber: index === 2 ? 1 : index + 1, sourceFilename: index === 2 ? 'detail.pdf' : 'assembly.pdf',
      canonicalPdfStoragePath: index === 1 ? 'selected.pdf' : 'sibling-must-not-be-read.pdf', previewStoragePath: 'preview.png',
      contentSha256: 'same-hash-to-exercise-duplicate-bypass', width: 612, height: 792,
      classification, reviewStatus: 'ACCEPTED', routeTier: 'terra_full_page',
      localExtractionJson: JSON.stringify(local), finalExtractionJson: JSON.stringify(previous),
    } });
    await runtime.db.drawingExtractionAttempt.create({ data: {
      pageId: id, stage: 'ai_resolution', sourceType: 'model', routeTier: 'terra_full_page',
      status: 'completed', idempotencyKey: crypto.randomUUID(), resultJson: JSON.stringify(response().output_parsed),
    } });
  }
  return { jobId: job.id, selectedId: ids[1], siblingIds: [ids[0], ids[2]] };
}

async function unchangedSiblings(ids: string[]) {
  return runtime.db.drawingImportPage.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' }, include: { attempts: true } });
}
async function waitForJob(jobId: string) {
  await vi.waitFor(async () => {
    const job = await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(['READY_FOR_REVIEW', 'PARTIAL_FAILURE']).toContain(job.status);
  }, { timeout: 15000, interval: 50 });
}

describe('selected-page reprocess (real SQLite, mocked AI)', () => {
  it('sends only the selected canonical page, retains confirmations and leaves sibling records/attempts byte-for-byte unchanged', async () => {
    const f = await fixture();
    const before = await unchangedSiblings(f.siblingIds);
    await reprocessQuoteDrawingImportV2Page(f.jobId, f.selectedId);
    await waitForJob(f.jobId);
    expect(runtime.parse).toHaveBeenCalledTimes(1);
    const body = runtime.parse.mock.calls[0][0];
    const content = body.input.flatMap((item: { content: unknown[] }) => item.content);
    const files = content.filter((item: { type: string }) => item.type === 'input_file');
    expect(files).toHaveLength(1);
    const bytes = Buffer.from(files[0].file_data.split(',')[1], 'base64');
    expect(bytes.equals(pdf)).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(JSON.stringify(body)).not.toContain('STALE-OCR-GUESS');
    expect(JSON.stringify(body)).not.toContain('Human confirmed name');
    expect(documentTools.createOcrEngine).not.toHaveBeenCalled();
    expect(getDrawingImportV2Config().ocrEnabled).toBe(false);
    expect(await unchangedSiblings(f.siblingIds)).toEqual(before);
    const selected = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.selectedId } });
    expect(JSON.parse(selected.finalExtractionJson!)).toMatchObject({
      partNumber: { value: 'FRESH-200' }, partName: { value: 'Human confirmed name', status: 'human_corrected' },
    });
    expect(await runtime.db.drawingExtractionAttempt.count({ where: { pageId: f.selectedId } })).toBe(2);
  });

  it('forces a reference/duplicate page through AI while retaining assembly quantities without rewriting its siblings', async () => {
    const f = await fixture(true, 'reference');
    const before = await unchangedSiblings(f.siblingIds);
    await reprocessQuoteDrawingImportV2Page(f.jobId, f.selectedId);
    await waitForJob(f.jobId);
    expect(runtime.parse).toHaveBeenCalledTimes(1);
    expect(await unchangedSiblings(f.siblingIds)).toEqual(before);
    const page = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.selectedId } });
    expect(JSON.parse(page.finalExtractionJson!).drawingQuantity.value).toBe(12);
    expect(page.classification).toBe('part_drawing');
  });

  it('keeps the previous review on AI failure and does not retry automatically or touch siblings', async () => {
    const f = await fixture();
    const before = await unchangedSiblings(f.siblingIds);
    const previous = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.selectedId } });
    runtime.parse.mockRejectedValue(Object.assign(new Error('synthetic unavailable'), { status: 503 }));
    await reprocessQuoteDrawingImportV2Page(f.jobId, f.selectedId);
    await waitForJob(f.jobId);
    expect(runtime.parse).toHaveBeenCalledTimes(1);
    const failed = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.selectedId } });
    expect(failed.reviewStatus).toBe('FAILED');
    expect(failed.finalExtractionJson).toBe(previous.finalExtractionJson);
    expect(await unchangedSiblings(f.siblingIds)).toEqual(before);
  });

  it('preserves a confirmation saved while the selected page request is in flight', async () => {
    const f = await fixture();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    runtime.parse.mockImplementation(async () => { await gate; return response(); });
    await reprocessQuoteDrawingImportV2Page(f.jobId, f.selectedId);
    await vi.waitFor(() => expect(runtime.parse).toHaveBeenCalledTimes(1));
    await saveQuoteDrawingImportV2FieldCorrection({ jobId: f.jobId, pageId: f.selectedId, field: 'material', value: 'Confirmed during AI request' });
    finish();
    await waitForJob(f.jobId);
    const selected = await runtime.db.drawingImportPage.findUniqueOrThrow({ where: { id: f.selectedId } });
    expect(JSON.parse(selected.finalExtractionJson!).material).toMatchObject({ value: 'Confirmed during AI request', status: 'human_corrected' });
  });

  it('persists retry scope for recovery, deduplicates clicks and rejects competing/cross-job requests', async () => {
    const f = await fixture();
    expect(await queueDrawingImportPageReprocess(f.jobId, f.selectedId)).toBe(true);
    expect(await queueDrawingImportPageReprocess(f.jobId, f.selectedId)).toBe(false);
    await expect(queueDrawingImportPageReprocess(f.jobId, f.siblingIds[0])).rejects.toThrow('Wait for');
    await expect(queueDrawingImportPageReprocess('wrong-job', f.selectedId)).rejects.toThrow('not found');
    const job = await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: f.jobId } });
    expect(JSON.parse(job.configJson).reprocessPageId).toBe(f.selectedId);
    // This is also the startup recovery entry point; no transient page-id argument is supplied.
    ensureQuoteDrawingImportV2JobProcessing(f.jobId);
    await waitForJob(f.jobId);
    expect(runtime.parse).toHaveBeenCalledTimes(1);
  });
});
