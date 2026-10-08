import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

import { buildReviewedQuoteDrawingImport } from '@/components/orders/drawing-import/quote-drawing-import';
import type { DrawingImportReviewPage } from '@/components/orders/drawing-import/drawing-import-ui.types';
import * as documentTools from '../document';
import {
  createQuoteDrawingImportV2Job,
  getQuoteDrawingImportV2JobSnapshot,
  saveQuoteDrawingImportV2FieldCorrection,
} from '../drawing-import-v2.service';
import { extractLocalDrawingFields } from '../local/drawing-import-local';

type SyntheticSheet = {
  marker: string;
  filename: string;
  heading: string;
  localClassification: string;
  modelClassification: 'assembly_drawing' | 'part_drawing' | 'bom';
  partNumber: string;
};
const sheets: SyntheticSheet[] = [
  { marker: 'SYNTHETIC-ASSEMBLY', filename: 'assembly/root.pdf', heading: 'ASSEMBLY\nBILL OF MATERIALS\nPART NO: ROOT-100', localClassification: 'bom', modelClassification: 'assembly_drawing', partNumber: 'ROOT-100' },
  { marker: 'SYNTHETIC-BOM-GUESS', filename: 'details/bracket.pdf', heading: 'BILL OF MATERIALS', localClassification: 'bom', modelClassification: 'part_drawing', partNumber: 'PART-101' },
  { marker: 'SYNTHETIC-UNCERTAIN', filename: 'details/spacer.pdf', heading: 'UNLABELED GEOMETRY', localClassification: 'uncertain', modelClassification: 'part_drawing', partNumber: 'PART-102' },
  { marker: 'SYNTHETIC-REFERENCE-GUESS', filename: 'details/plate.pdf', heading: 'REFERENCE ONLY', localClassification: 'reference', modelClassification: 'part_drawing', partNumber: 'PART-103' },
  { marker: 'SYNTHETIC-COVER-GUESS', filename: 'details/pin.pdf', heading: 'COVER SHEET', localClassification: 'cover_sheet', modelClassification: 'part_drawing', partNumber: 'PART-104' },
  { marker: 'SYNTHETIC-SUPPORTING', filename: 'supporting/notes.pdf', heading: 'BILL OF MATERIALS', localClassification: 'bom', modelClassification: 'bom', partNumber: 'BOM-100' },
];
const terminalStatuses = ['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED', 'COMPLETE'];
const requests: Array<{ marker: string; hash: string; bytes: Buffer }> = [];

async function createSheet(sheet: SyntheticSheet) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText(sheet.marker, { x: 30, y: 750, size: 11, font });
  page.drawText(sheet.heading, { x: 30, y: 720, size: 11, lineHeight: 18, font });
  if (sheet.modelClassification === 'assembly_drawing') {
    const columns = [30, 105, 255, 420, 480];
    const rows = [
      ['ITEM', 'PART NUMBER', 'DESCRIPTION', 'QTY', 'MATERIAL'],
      ['1', 'PART-101', 'Bracket', '2', '6061'],
      ['2', 'PART-102', 'Spacer', '3', '6061'],
      ['3', 'PART-103', 'Plate', '4', '6061'],
      ['4', 'PART-104', 'Pin', '5', '6061'],
    ];
    rows.forEach((row, index) => row.forEach((text, column) => {
      page.drawText(text, { x: columns[column], y: 570 - index * 24, size: 10, font });
    }));
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function modelResponse(sheet: SyntheticSheet) {
  const field = (value: string | number | boolean | null) => ({
    value, rawText: value === null ? null : String(value), status: value === null ? 'not_present' : 'read',
    evidenceText: value === null ? null : String(value), sourceRegionIdentity: null, warnings: [], diagnosticConfidence: 0.9,
  });
  return {
    status: 'completed', output: [], id: `synthetic-${sheet.marker}`,
    usage: { input_tokens: 100, output_tokens: 100 },
    output_parsed: {
      classification: sheet.modelClassification, classificationEvidenceText: sheet.marker,
      partNumber: field(sheet.partNumber), partName: field(`Reviewed ${sheet.partNumber}`), drawingQuantity: field(1),
      material: field('6061'), finish: field('NA'), stockSize: field(null), cutLength: field(null),
      finalLength: field('4'), partWidth: field('2'), partThickness: field('0.5'), revision: field(null),
      assemblyStatus: field(sheet.modelClassification === 'assembly_drawing'), manufacturingNotes: [], contradictions: [], warnings: [],
    },
  };
}

beforeAll(async () => {
  runtime.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-zip-workflow-'));
  await writeFile(path.join(runtime.root, 'test.db'), '');
  const url = `file:${path.join(runtime.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60_000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-a-real-key');
  vi.stubEnv('DRAWING_IMPORT_V2_MODE', 'admin_beta');
  vi.stubEnv('DRAWING_IMPORT_V3_ENABLED', 'true');
  vi.stubEnv('DRAWING_IMPORT_V2_RETRY_LIMIT', '5');
  vi.stubEnv('DRAWING_IMPORT_V2_PDF_CONCURRENCY', '1');
  vi.stubEnv('DRAWING_IMPORT_V2_PDF_AI_CONCURRENCY', '2');
  vi.spyOn(documentTools, 'createOcrEngine').mockImplementation(() => { throw new Error('V3 must not start OCR'); });
}, 60_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await runtime.db?.$disconnect();
  if (path.dirname(runtime.root) === path.resolve(os.tmpdir()) && path.basename(runtime.root).startsWith('shopapp-zip-workflow-')) {
    await rm(runtime.root, { recursive: true, force: true });
  }
});

describe('production-order ZIP workflow (real SQLite and document pipeline, mocked AI)', () => {
  it('automatically reviews unique separate PDFs, persists BOM edges, and maps saved human review without Treat as part or repeated AI', async () => {
    const archive = new JSZip();
    const originals = new Map<string, Buffer>();
    for (const sheet of sheets) {
      const bytes = await createSheet(sheet);
      originals.set(sheet.filename, bytes);
      const text = await documentTools.extractCoordinateAwarePdfText(bytes);
      expect(extractLocalDrawingFields({ pageId: sheet.marker, filename: path.basename(sheet.filename), page: text }).classification.classification).toBe(sheet.localClassification);
      archive.file(sheet.filename, bytes);
    }
    archive.file('duplicates/bracket-copy.pdf', originals.get(sheets[1].filename)!);
    const buffer = await archive.generateAsync({ type: 'nodebuffer' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    runtime.parse.mockImplementation(async (body) => {
      const content = body.input.flatMap((item: { content: Array<{ type: string; file_data?: string }> }) => item.content);
      const attachments = content.filter((item: { type: string }) => item.type !== 'input_text');
      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toMatchObject({ type: 'input_file', detail: 'high' });
      const bytes = Buffer.from(attachments[0].file_data.split(',')[1], 'base64');
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      const text = await documentTools.extractCoordinateAwarePdfText(bytes);
      const sheet = sheets.find((candidate) => text.rawText.includes(candidate.marker));
      expect(sheet, 'AI must receive exactly one known canonical page').toBeDefined();
      requests.push({ marker: sheet!.marker, hash: createHash('sha256').update(bytes).digest('hex'), bytes });
      await gate;
      return modelResponse(sheet!);
    });
    const started = await createQuoteDrawingImportV2Job({
      destination: 'order', createdById: null, business: 'Sterling Tool and Die', customerName: 'Synthetic workflow customer',
      draftReference: 'SYNTHETIC-ZIP', intakeMode: 'ASSEMBLY', assemblyMultiplier: 2,
      filename: 'separate-drawings.zip', mimeType: 'application/zip', buffer,
    });
    const jobId = started.progress.jobId;
    try {
      await vi.waitFor(() => expect(runtime.parse).toHaveBeenCalledTimes(2), { timeout: 30_000, interval: 50 });
      const pending = await getQuoteDrawingImportV2JobSnapshot(jobId);
      expect(pending.progress.status).toBe('PROCESSING');
      expect(pending.pages).toHaveLength(7);
      expect(pending.pages.some((page) => page.processingStatus === 'processing')).toBe(true);
      expect(pending.pages.some((page) => page.processingStatus === 'queued')).toBe(true);
    } finally {
      release();
    }
    await vi.waitFor(async () => {
      const job = await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: jobId } });
      expect(terminalStatuses).toContain(job.status);
    }, { timeout: 30_000, interval: 50 });
    let snapshot = await getQuoteDrawingImportV2JobSnapshot(jobId);
    expect(snapshot.progress).toMatchObject({ status: 'READY_FOR_REVIEW', totalPages: 7, completedPages: 7, failedPages: 0, errorSummary: null });
    expect(snapshot.pages.every((page) => page.sourcePageCount === 1 && page.sourcePageNumber === 1 && page.processingStatus === 'ready')).toBe(true);
    expect(runtime.parse).toHaveBeenCalledTimes(sheets.length);
    expect(new Set(requests.map((request) => request.hash)).size).toBe(sheets.length);
    expect(requests.map((request) => request.marker).sort()).toEqual(sheets.map((sheet) => sheet.marker).sort());
    expect(documentTools.createOcrEngine).not.toHaveBeenCalled();

    const saved = await runtime.db.drawingImportJob.findUniqueOrThrow({ where: { id: jobId }, include: { sources: true, pages: { include: { attempts: true } }, bomRows: { include: { edge: true }, orderBy: { rowIndex: 'asc' } } } });
    expect(saved.sources.filter((source) => source.sourceKind === 'archive_drawing')).toHaveLength(7);
    expect(saved.pages.filter((page) => page.classification === 'duplicate')).toHaveLength(1);
    for (const page of saved.pages) {
      const bytes = await readFile(path.join(runtime.root, page.canonicalPdfStoragePath!));
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      expect(page.attempts.filter((attempt) => attempt.sourceType === 'model')).toHaveLength(page.classification === 'duplicate' ? 0 : 1);
    }
    expect(saved.bomRows).toHaveLength(4);
    const assembly = snapshot.pages.find((page) => page.classification === 'assembly_drawing')!;
    saved.bomRows.forEach((row, index) => {
      const child = snapshot.pages.find((page) => page.extraction?.partNumber.value === `PART-${101 + index}` && page.classification === 'part_drawing')!;
      expect(row.id).toBe(`${assembly.pageId}:bom-row:${index}`);
      expect(row.edge).toMatchObject({ bomRowId: row.id, parentPageId: assembly.pageId, childPageId: child.pageId, quantityPerParent: index + 2, status: 'matched' });
      expect(child.extraction?.drawingQuantity.value).toBe((index + 2) * 2);
    });
    expect(snapshot.pages.filter((page) => page.classification === 'part_drawing')).toHaveLength(4);
    const supporting = snapshot.pages.find((page) => page.filename === 'notes.pdf')!;
    expect(supporting.classification).toBe('bom');
    const corrected = snapshot.pages.find((page) => page.extraction?.partNumber.value === 'PART-102')!;
    await saveQuoteDrawingImportV2FieldCorrection({ jobId, pageId: corrected.pageId, field: 'partName', value: 'Human confirmed spacer' });
    snapshot = await getQuoteDrawingImportV2JobSnapshot(jobId);
    const result = buildReviewedQuoteDrawingImport(snapshot.pages as DrawingImportReviewPage[], [{ id: 'synthetic-6061', name: '6061' }], snapshot.supportingFiles);
    expect(result.blockingMessages).toEqual([]);
    expect(result.parts).toHaveLength(5);
    expect(result.parts.find((part) => part.importPageId === corrected.pageId)).toMatchObject({ partName: 'Human confirmed spacer', quantity: 6, materialId: 'synthetic-6061' });
    expect(result.parts.some((part) => part.importPageId === supporting.pageId)).toBe(false);
    expect(result.files.some((file) => file.storagePath === supporting.originalPacketSource?.storagePath)).toBe(true);
    expect(result.files.some((file) => file.label === 'separate-drawings.zip')).toBe(true);
    expect(runtime.parse).toHaveBeenCalledTimes(sheets.length);
    expect(await runtime.db.order.count()).toBe(0);
    expect(await runtime.db.orderPart.count()).toBe(0);
  }, 60_000);
});
