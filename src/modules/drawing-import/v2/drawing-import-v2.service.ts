import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import { getAppSettings } from '@/lib/app-settings';
import { BUSINESS_NAMES, ensureAttachmentRoot, storeAttachmentFile, type BusinessName } from '@/lib/storage';
import {
  createDrawingImportAiAdapter,
  createOpenAiDrawingImportResponsesPort,
} from './ai/drawing-import-ai.adapter';
import { getDrawingImportAiSettings } from './ai/drawing-import-ai.config';
import {
  DEFAULT_DRAWING_IMPORT_PRICING_CATALOG,
  DrawingImportAiBudgetController,
} from './ai/drawing-import-ai.pricing';
import { decideDrawingImportSolEscalation } from './ai/drawing-import-ai.router';
import { DRAWING_IMPORT_AI_PROMPT_VERSION } from './ai/drawing-import-ai.prompt';
import { DrawingImportAiExtraction as DrawingImportAiExtractionSchema, type DrawingImportAiExtraction } from './ai/drawing-import-ai.schema';
import { reconstructBomTable } from './bom/bom-table';
import { calculateAssemblyQuantities } from './bom/quantity-graph';
import type { AssemblyGraphEdge, AssemblyGraphNode, DrawingBomRow } from './bom/bom.types';
import {
  createOcrEngine,
  cropPreview,
  differenceHash,
  extractCoordinateAwarePdfText,
  extractDrawingArchive,
  reconstructTextLines,
  renderPdfPreview,
  sha256Hex,
  splitPdfToCanonicalPages,
  type CoordinateAwarePageText,
  type ExtractedDrawingArchiveEntry,
  type PreviewArtifact,
} from './document';
import {
  DRAWING_IMPORT_LOCAL_PARSER_VERSION,
  extractLocalDrawingFields,
  locallyAcceptableFields,
} from './local/drawing-import-local';
import {
  canDrawingImportPageCreatePart,
  drawingImportExtractionNeedsHumanReview,
  mergeDrawingImportAiExtraction,
} from './drawing-import-v2.mapping';
import {
  claimQueuedDrawingImportJob,
  claimStaleDrawingImportJob,
  createDrawingExtractionAttempt,
  createDrawingImportBomRows,
  createDrawingImportJob,
  createDrawingImportPage,
  createDrawingImportSource,
  countDrawingImportAttempts,
  findDrawingImportJobById,
  findDrawingImportJobByIdempotencyKey,
  findDrawingImportPage,
  findDrawingImportPageForJob,
  findDrawingImportSource,
  findCompletedDrawingImportAiAttempt,
  findDuplicateDrawingImportPage,
  isDrawingImportCancellationRequested,
  listActiveDrawingImportJobs,
  listDrawingImportPageStatuses,
  listDrawingImportBomRows,
  recordHumanDrawingImportCorrection,
  replaceDrawingImportBomEdges,
  markDrawingImportPageFailed,
  queueDrawingImportJob,
  requestDrawingImportCancellation,
  resetDrawingImportPageForReprocess,
  setDrawingImportJobState,
  toDrawingImportJobProgress,
  touchDrawingImportJob,
  updateDrawingImportPageLocalAnalysis,
  updateDrawingImportPageClassification,
  updateDrawingImportPageResult,
  updateDrawingImportSourcePageCount,
} from './drawing-import-v2.repo';
import { getDrawingImportV2Config } from './drawing-import-v2.config';
import {
  DRAWING_IMPORT_FIELD_NAMES,
  DRAWING_IMPORT_V2_PIPELINE_VERSION,
  normalizeDrawingImportPageExtraction,
  type DrawingImportFieldName,
  type DrawingImportFieldValue,
  type DrawingImportNormalizedRegion,
  type DrawingImportPageExtraction,
  type DrawingImportPageClassification,
  type DrawingImportV2Config,
} from './drawing-import-v2.types';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const STALE_JOB_MS = 2 * 60 * 1000;
const JOB_HEARTBEAT_MS = 30 * 1000;
const RECOVERY_SWEEP_MS = 30 * 1000;
const activeJobs = new Map<string, Promise<void>>();

export function createDrawingImportConcurrencyGate(limit: number) {
  const maximum = Math.max(1, Math.floor(limit));
  const waiters: Array<() => void> = [];
  let active = 0;

  async function acquire() {
    if (active < maximum) {
      active += 1;
      return;
    }
    await new Promise<void>(resolve => waiters.push(resolve));
    active += 1;
  }

  function release() {
    active -= 1;
    waiters.shift()?.();
  }

  return {
    async run<T>(work: () => Promise<T>) {
      await acquire();
      try { return await work(); }
      finally { release(); }
    },
  };
}

export function startDrawingImportJobHeartbeat(
  jobId: string,
  options: { intervalMs?: number; touch?: (id: string) => Promise<unknown> } = {},
) {
  const intervalMs = Math.max(10, options.intervalMs ?? JOB_HEARTBEAT_MS);
  const touch = options.touch ?? ((id: string) => touchDrawingImportJob(id));
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending.then(() => touch(jobId)).then(() => undefined, () => undefined);
  }, intervalMs);
  timer.unref?.();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}

export function createDrawingImportRecoveryCoordinator(options: {
  list: () => Promise<Array<{ id: string; status: string }>>;
  ensure: (jobId: string) => void;
  cancel: (jobId: string) => Promise<unknown>;
  intervalMs?: number;
}) {
  const intervalMs = Math.max(10, options.intervalMs ?? RECOVERY_SWEEP_MS);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sweeping = false;
  let stopped = false;

  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = null; void sweep(); }, intervalMs);
    timer.unref?.();
  };
  const sweep = async () => {
    if (stopped || sweeping) return;
    sweeping = true;
    try {
      const jobs = await options.list();
      for (const job of jobs) {
        if (job.status === 'CANCEL_REQUESTED') await options.cancel(job.id).catch(() => undefined);
        else options.ensure(job.id);
      }
      if (jobs.length) schedule();
    } catch {
      schedule();
    } finally {
      sweeping = false;
    }
  };

  return {
    start() {
      stopped = false;
      void sweep();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

let recoveryCoordinator: ReturnType<typeof createDrawingImportRecoveryCoordinator> | null = null;
function startDrawingImportRecoveryLoop() {
  recoveryCoordinator ??= createDrawingImportRecoveryCoordinator({
    list: listActiveDrawingImportJobs,
    ensure: ensureQuoteDrawingImportV2JobProcessing,
    cancel: jobId => setDrawingImportJobState({ jobId, status: 'CANCELLED', stage: 'complete', completed: true }),
  });
  recoveryCoordinator.start();
}

type StoredDrawing = {
  sourceKind: string;
  archivePath: string | null;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  sha256: string;
  storagePath: string;
};

type ProcessedPage = {
  id: string;
  sourceId: string;
  sourceFilename: string;
  sourcePageNumber: number;
  sourcePageCount: number;
  canonicalPdfStoragePath: string;
  previewStoragePath: string;
  canonicalPdf: Buffer;
  sourceImage: { mimeType: 'image/png' | 'image/jpeg'; bytes: Buffer } | null;
  preview: PreviewArtifact;
  text: CoordinateAwarePageText;
  localExtraction: DrawingImportPageExtraction;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mimeFromFilename(filename: string, supplied?: string | null) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.zip') return 'application/zip';
  return supplied?.trim() || 'application/octet-stream';
}

function isArchive(filename: string, mimeType: string) {
  return path.extname(filename).toLowerCase() === '.zip' || mimeType === 'application/zip';
}

function safeBusiness(value: string): BusinessName {
  if (!(BUSINESS_NAMES as readonly string[]).includes(value)) throw new Error('Choose a valid business.');
  return value as BusinessName;
}

async function readStoredFile(storagePath: string, rootDir: string) {
  const root = await ensureAttachmentRoot(rootDir);
  const normalized = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const target = path.resolve(root, ...normalized.split('/'));
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Stored drawing path is outside the attachment root.');
  return readFile(target);
}

function filenameWithoutExtension(filename: string) {
  return path.basename(filename, path.extname(filename));
}

function contentTypeForSourceKind(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return extension === '.zip' ? 'archive' : 'drawing';
}

async function storeDerived(input: {
  business: BusinessName;
  customerName: string;
  draftReference: string;
  filename: string;
  bytes: Buffer;
  rootDir: string;
}) {
  return storeAttachmentFile({
    business: input.business,
    customerName: input.customerName,
    referenceNumber: input.draftReference,
    originalFilename: input.filename,
    buffer: input.bytes,
    rootDir: input.rootDir,
  });
}

export function getQuoteDrawingImportV2FeatureStatus() {
  startDrawingImportRecoveryLoop();
  const config = getDrawingImportV2Config();
  const keyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return {
    enabled: config.mode !== 'disabled',
    mode: config.mode,
    version: config.directPdfV3Enabled ? 'V3' : 'V2',
    reason: config.mode === 'disabled'
      ? 'Drawing Import V2 is disabled by configuration.'
      : keyConfigured
        ? null
        : 'OPENAI_API_KEY is not configured; local extraction remains available but uncertain pages require manual review.',
  };
}

export async function createQuoteDrawingImportV2Job(input: {
  destination?: 'quote' | 'order';
  createdById: string | null;
  business: string;
  customerName: string;
  draftReference: string;
  intakeMode: 'ONE_OFF' | 'ASSEMBLY';
  assemblyMultiplier: number;
  filename: string;
  mimeType?: string | null;
  buffer: Buffer;
  idempotencyKey?: string | null;
}) {
  const config = getDrawingImportV2Config();
  if (config.mode === 'disabled') throw new Error('Drawing Import V2 is not enabled.');
  if (!input.customerName.trim()) throw new Error('Choose a customer before importing drawings.');
  if (!input.draftReference.trim()) throw new Error('Missing quote draft reference.');
  if (!input.filename.trim()) throw new Error('Choose a drawing or ZIP.');
  if (!input.buffer.length) throw new Error('The uploaded drawing is empty.');
  if (input.buffer.length > MAX_UPLOAD_BYTES) throw new Error('This drawing upload is larger than 100 MB.');
  const business = safeBusiness(input.business);
  const assemblyMultiplier = input.intakeMode === 'ASSEMBLY'
    ? Math.max(1, Math.floor(input.assemblyMultiplier || 1))
    : 1;
  const mimeType = mimeFromFilename(input.filename, input.mimeType);
  if (!['application/pdf', 'image/png', 'image/jpeg', 'application/zip'].includes(mimeType)) {
    throw new Error('Upload a PDF, PNG, JPG, JPEG, or ZIP file.');
  }
  const settings = await getAppSettings();
  const stored = await storeAttachmentFile({
    business,
    customerName: input.customerName,
    referenceNumber: input.draftReference,
    originalFilename: input.filename,
    buffer: input.buffer,
    rootDir: settings.attachmentsDir,
  });
  const fileHash = sha256Hex(input.buffer);
  const idempotencyKey = input.idempotencyKey?.trim() || `quote-v2-${randomUUID()}`;
  const existing = await findDrawingImportJobByIdempotencyKey(idempotencyKey);
  if (existing) {
    ensureQuoteDrawingImportV2JobProcessing(existing.id);
    return getQuoteDrawingImportV2JobSnapshot(existing.id);
  }
  const job = await createDrawingImportJob({
    idempotencyKey,
    createdById: input.createdById,
    destination: input.destination ?? 'quote',
    business,
    customerName: input.customerName.trim(),
    draftReference: input.draftReference.trim(),
    intakeMode: input.intakeMode,
    assemblyMultiplier,
    pipelineVersion: DRAWING_IMPORT_V2_PIPELINE_VERSION,
    mode: config.mode,
    config,
    softBudgetUsd: config.softBudgetUsd,
    hardBudgetUsd: config.hardBudgetUsd,
    source: {
      sourceKind: contentTypeForSourceKind(input.filename),
      originalFilename: path.basename(input.filename),
      mimeType,
      sizeBytes: input.buffer.length,
      sha256: fileHash,
      storagePath: stored.storagePath,
    },
  });
  startDrawingImportRecoveryLoop();
  ensureQuoteDrawingImportV2JobProcessing(job.id);
  return getQuoteDrawingImportV2JobSnapshot(job.id);
}

async function canonicalizeImage(bytes: Buffer, mimeType: string) {
  const normalizedImage = await sharp(bytes, { failOn: 'error' }).rotate().png().toBuffer();
  const metadata = await sharp(normalizedImage).metadata();
  if (!metadata.width || !metadata.height) throw new Error('The drawing image dimensions could not be read.');
  const document = await PDFDocument.create({ updateMetadata: false });
  const embedded = await document.embedPng(normalizedImage);
  const page = document.addPage([metadata.width, metadata.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: metadata.width, height: metadata.height });
  const pdf = Buffer.from(await document.save({ useObjectStreams: false, updateFieldAppearances: false }));
  return {
    pdf,
    preview: { mimeType: 'image/png' as const, bytes: normalizedImage, width: metadata.width, height: metadata.height, hash: sha256Hex(normalizedImage) },
    originalMimeType: mimeType,
  };
}

function emptyCoordinateText(pageWidth: number, pageHeight: number): CoordinateAwarePageText {
  return {
    pageNumber: 1,
    pageWidth,
    pageHeight,
    pageRotation: 0,
    rawText: '',
    spans: [],
    lines: [],
    extractionMethod: 'embedded_text',
  };
}

async function applyOcrIfNeeded(text: CoordinateAwarePageText, preview: PreviewArtifact) {
  const config = getDrawingImportV2Config();
  const lowDensity = text.rawText.trim().length < 24 || text.spans.length < 3;
  if (!config.ocrEnabled || !lowDensity) return text;
  const engine = createOcrEngine({ enabled: true });
  try {
    const result = await engine.recognize(preview.bytes);
    if (!result.spans.length) return text;
    return {
      pageNumber: 1,
      pageWidth: preview.width,
      pageHeight: preview.height,
      pageRotation: 0,
      rawText: result.rawText,
      spans: result.spans,
      lines: reconstructTextLines(result.spans),
      extractionMethod: 'ocr' as const,
    };
  } finally {
    await engine.close();
  }
}

async function retainArchiveChildren(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  archiveBytes: Buffer;
  rootDir: string;
}) {
  const business = safeBusiness(input.job.business);
  const extracted = await extractDrawingArchive(input.archiveBytes);
  const children: StoredDrawing[] = [];
  for (const entry of [...extracted.drawings, ...extracted.supportingSolidWorks]) {
    const existing = await findDrawingImportSource(input.job.id, { archivePath: entry.archivePath, sha256: entry.contentHash });
    if (existing) {
      if (entry.disposition === 'drawing') {
        children.push({
          sourceKind: existing.sourceKind,
          archivePath: existing.archivePath,
          filename: existing.originalFilename,
          mimeType: existing.mimeType,
          bytes: entry.bytes,
          sha256: existing.sha256,
          storagePath: existing.storagePath,
        });
      }
      continue;
    }
    const stored = await storeDerived({
      business,
      customerName: input.job.customerName,
      draftReference: input.job.draftReference,
      filename: entry.filename,
      bytes: entry.bytes,
      rootDir: input.rootDir,
    });
    const sourceKind = entry.disposition === 'drawing' ? 'archive_drawing' : 'supporting_solidworks';
    const source = await createDrawingImportSource(input.job.id, {
      sourceKind,
      originalFilename: entry.filename,
      archivePath: entry.archivePath,
      mimeType: entry.mimeType,
      sizeBytes: entry.bytes.length,
      sha256: entry.contentHash,
      storagePath: stored.storagePath,
      warnings: entry.disposition === 'supporting_solidworks' ? ['Retained for traceability; not interpreted as a drawing.'] : [],
    });
    if (entry.disposition === 'drawing') {
      children.push({ sourceKind, archivePath: entry.archivePath, filename: entry.filename, mimeType: entry.mimeType, bytes: entry.bytes, sha256: entry.contentHash, storagePath: source.storagePath });
    }
  }
  return children;
}

async function inventoryJobSources(job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>, rootDir: string) {
  const primary = job.sources[0];
  if (!primary) throw new Error('The import job has no source file.');
  if (primary.sourceKind === 'archive') {
    const archiveBytes = await readStoredFile(primary.storagePath, rootDir);
    return retainArchiveChildren({ job, archiveBytes, rootDir });
  }
  return [{
    sourceKind: primary.sourceKind,
    archivePath: primary.archivePath,
    filename: primary.originalFilename,
    mimeType: primary.mimeType,
    bytes: await readStoredFile(primary.storagePath, rootDir),
    sha256: primary.sha256,
    storagePath: primary.storagePath,
  } satisfies StoredDrawing];
}

async function sourceRecordForDrawing(jobId: string, drawing: StoredDrawing) {
  const existing = await findDrawingImportSource(jobId, { archivePath: drawing.archivePath, sha256: drawing.sha256 });
  if (!existing) throw new Error(`Stored drawing source is missing for ${drawing.filename}.`);
  return existing;
}

async function createOrLoadPage(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  sourceId: string;
  drawing: StoredDrawing;
  sourcePageNumber: number;
  sourcePageCount: number;
  canonicalPdf: Buffer;
  preview: PreviewArtifact;
  width: number;
  height: number;
  rotation: number;
  rootDir: string;
}) {
  const existing = await findDrawingImportPage(input.sourceId, input.sourcePageNumber);
  if (existing?.canonicalPdfStoragePath && existing.previewStoragePath) return existing;
  const business = safeBusiness(input.job.business);
  const stem = filenameWithoutExtension(input.drawing.filename);
  const suffix = String(input.sourcePageNumber).padStart(3, '0');
  const canonical = await storeDerived({
    business,
    customerName: input.job.customerName,
    draftReference: input.job.draftReference,
    filename: `${stem}-page-${suffix}.pdf`,
    bytes: input.canonicalPdf,
    rootDir: input.rootDir,
  });
  const preview = await storeDerived({
    business,
    customerName: input.job.customerName,
    draftReference: input.job.draftReference,
    filename: `${stem}-page-${suffix}-preview.png`,
    bytes: input.preview.bytes,
    rootDir: input.rootDir,
  });
  return createDrawingImportPage(input.job.id, input.sourceId, {
    sourcePageNumber: input.sourcePageNumber,
    sourceFilename: input.drawing.filename,
    canonicalPdfStoragePath: canonical.storagePath,
    previewStoragePath: preview.storagePath,
    contentSha256: sha256Hex(input.canonicalPdf),
    perceptualHash: await differenceHash(input.preview.bytes),
    width: input.width,
    height: input.height,
    rotation: input.rotation,
  });
}

async function analyzePage(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  sourceId: string;
  drawing: StoredDrawing;
  sourcePageNumber: number;
  sourcePageCount: number;
  canonicalPdf: Buffer;
  preview: PreviewArtifact;
  width: number;
  height: number;
  rotation: number;
  rootDir: string;
}): Promise<ProcessedPage> {
  const pageRecord = await createOrLoadPage(input);
  const embeddedText = await extractCoordinateAwarePdfText(input.canonicalPdf).catch(() => emptyCoordinateText(input.width, input.height));
  const text = await applyOcrIfNeeded(embeddedText, input.preview);
  const local = extractLocalDrawingFields({ pageId: pageRecord.id, filename: input.drawing.filename, page: text });
  const config = getDrawingImportV2Config();
  local.extraction.autoAcceptedFields = locallyAcceptableFields(local.extraction, {
    enabled: config.localAutoAcceptEnabled,
    profileMatched: Boolean(local.profileMatch?.matched),
  });
  await updateDrawingImportPageLocalAnalysis({
    pageId: pageRecord.id,
    classification: local.classification.classification,
    classificationConfidence: Math.min(1, local.classification.score / 10),
    extraction: local.extraction,
    warnings: local.extraction.warnings,
  });
  await createDrawingExtractionAttempt({
    pageId: pageRecord.id,
    stage: 'local_analysis',
    sourceType: text.extractionMethod,
    routeTier: 'local',
    idempotencyKey: `${input.job.id}:${pageRecord.id}:local:${DRAWING_IMPORT_LOCAL_PARSER_VERSION}`,
    parserVersion: DRAWING_IMPORT_LOCAL_PARSER_VERSION,
    result: local.extraction,
    warnings: local.extraction.warnings,
  }).catch((error) => {
    if (!(error instanceof Error) || !error.message.includes('Unique constraint')) throw error;
  });
  return {
    id: pageRecord.id,
    sourceId: input.sourceId,
    sourceFilename: input.drawing.filename,
    sourcePageNumber: input.sourcePageNumber,
    sourcePageCount: input.sourcePageCount,
    canonicalPdfStoragePath: pageRecord.canonicalPdfStoragePath!,
    previewStoragePath: pageRecord.previewStoragePath!,
    canonicalPdf: input.canonicalPdf,
    sourceImage: input.drawing.mimeType === 'image/png' || input.drawing.mimeType === 'image/jpeg'
      ? { mimeType: input.drawing.mimeType, bytes: input.drawing.bytes }
      : null,
    preview: input.preview,
    text,
    localExtraction: local.extraction,
  };
}

async function analyzeDrawingSource(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  drawing: StoredDrawing;
  rootDir: string;
}) {
  const source = await sourceRecordForDrawing(input.job.id, input.drawing);
  const existingPages = input.job.pages.filter((page) => page.sourceId === source.id);
  if (existingPages.length && source.pageCount && existingPages.length >= source.pageCount) {
    const pages: ProcessedPage[] = [];
    for (const page of existingPages) {
      if (!page.canonicalPdfStoragePath || !page.previewStoragePath) continue;
      const canonicalPdf = await readStoredFile(page.canonicalPdfStoragePath, input.rootDir);
      const previewBytes = await readStoredFile(page.previewStoragePath, input.rootDir);
      const previewMeta = await sharp(previewBytes).metadata();
      const preview: PreviewArtifact = {
        mimeType: 'image/png',
        bytes: previewBytes,
        width: previewMeta.width ?? Math.max(1, Math.round(page.width)),
        height: previewMeta.height ?? Math.max(1, Math.round(page.height)),
        hash: sha256Hex(previewBytes),
      };
      const text = await applyOcrIfNeeded(await extractCoordinateAwarePdfText(canonicalPdf), preview);
      const localExtraction = normalizeDrawingImportPageExtraction(parseJson<DrawingImportPageExtraction>(
        page.localExtractionJson,
        extractLocalDrawingFields({ pageId: page.id, filename: page.sourceFilename, page: text }).extraction,
      ));
      pages.push({
        id: page.id,
        sourceId: source.id,
        sourceFilename: page.sourceFilename,
        sourcePageNumber: page.sourcePageNumber,
        sourcePageCount: source.pageCount,
        canonicalPdfStoragePath: page.canonicalPdfStoragePath,
        previewStoragePath: page.previewStoragePath,
        canonicalPdf,
        sourceImage: input.drawing.mimeType === 'image/png' || input.drawing.mimeType === 'image/jpeg'
          ? { mimeType: input.drawing.mimeType, bytes: input.drawing.bytes }
          : null,
        preview,
        text,
        localExtraction,
      });
    }
    return pages;
  }

  if (input.drawing.mimeType === 'application/pdf') {
    const canonicalPages = await splitPdfToCanonicalPages({
      sourceBytes: input.drawing.bytes,
      sourceFileId: source.id,
      sourceFilename: input.drawing.filename,
      pageLimit: 100,
    });
    await updateDrawingImportSourcePageCount(source.id, canonicalPages.length);
    const pages: ProcessedPage[] = [];
    for (const canonical of canonicalPages) {
      if (await isDrawingImportCancellationRequested(input.job.id)) break;
      const preview = await renderPdfPreview(canonical.bytes);
      pages.push(await analyzePage({
        job: input.job,
        sourceId: source.id,
        drawing: input.drawing,
        sourcePageNumber: canonical.sourcePageNumber,
        sourcePageCount: canonical.sourcePageCount,
        canonicalPdf: canonical.bytes,
        preview,
        width: canonical.widthPoints,
        height: canonical.heightPoints,
        rotation: canonical.rotationDegrees,
        rootDir: input.rootDir,
      }));
    }
    return pages;
  }

  const canonical = await canonicalizeImage(input.drawing.bytes, input.drawing.mimeType);
  await updateDrawingImportSourcePageCount(source.id, 1);
  return [await analyzePage({
    job: input.job,
    sourceId: source.id,
    drawing: input.drawing,
    sourcePageNumber: 1,
    sourcePageCount: 1,
    canonicalPdf: canonical.pdf,
    preview: canonical.preview,
    width: canonical.preview.width,
    height: canonical.preview.height,
    rotation: 0,
    rootDir: input.rootDir,
  })];
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>) {
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), values.length || 1) }, worker));
  return output;
}

function spansForBom(page: ProcessedPage) {
  return page.text.spans.map((span) => ({
    pageId: page.id,
    text: span.text,
    region: span.region,
    readingOrder: span.readingOrder,
    rotation: span.textRotation,
  }));
}

async function parseAndPersistBoms(jobId: string, pages: ProcessedPage[]) {
  const output: DrawingBomRow[] = [];
  for (const page of pages.filter((candidate) => ['bom', 'assembly_drawing'].includes(candidate.localExtraction.classification))) {
    const reconstruction = reconstructBomTable(page.id, spansForBom(page), {
      parentAssemblyPartNumber: page.localExtraction.partNumber.value,
      parentAssemblyEvidence: page.localExtraction.partNumber.evidence,
    });
    output.push(...reconstruction.rows);
    await createDrawingImportBomRows(jobId, reconstruction.rows.map((row) => ({
      sourcePageId: row.sourcePageId,
      rowIndex: row.rowIndex,
      item: row.item.value,
      childPartNumber: row.partNumber.value,
      description: row.description.value,
      quantityPerParent: row.quantityPerParent.value,
      material: row.material.value,
      revision: row.revision.value,
      parentAssemblyPartNumber: row.parentAssemblyPartNumber.value,
      sourceRegion: row.sourceRegion,
      rawCells: row.rawCells,
      warnings: [...reconstruction.warnings, ...row.warnings],
    })));
  }
  return output;
}

function hasStrongLocalContradiction(local: DrawingImportPageExtraction, ai: DrawingImportAiExtraction) {
  return local.autoAcceptedFields.some((name) => {
    const left = local[name].value;
    const right = ai[name].value;
    return left !== null && right !== null && String(left).trim().toUpperCase() !== String(right).trim().toUpperCase();
  });
}

async function completedAiAttempt(pageId: string, routeTier: string) {
  const attempt = await findCompletedDrawingImportAiAttempt(pageId, routeTier);
  if (!attempt?.resultJson) return null;
  const parsed = DrawingImportAiExtractionSchema.safeParse(parseJson(attempt.resultJson, null));
  return parsed.success ? parsed.data : null;
}

async function nextAttemptSequence(pageId: string, routeTier: string) {
  return 1 + await countDrawingImportAttempts(pageId, routeTier);
}

async function resolvePageWithAi(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  page: ProcessedPage;
  rows: DrawingBomRow[];
  rootDir: string;
  adapter: ReturnType<typeof createDrawingImportAiAdapter> | null;
  config: DrawingImportV2Config;
  budget: DrawingImportAiBudgetController;
  stageGates: {
    targeted: ReturnType<typeof createDrawingImportConcurrencyGate>;
    fullPage: ReturnType<typeof createDrawingImportConcurrencyGate>;
    sol: ReturnType<typeof createDrawingImportConcurrencyGate>;
  };
}) {
  const config = input.config;
  const duplicate = await findDuplicateDrawingImportPage(input.job.id, input.page.id, sha256Hex(input.page.canonicalPdf));
  if (duplicate) {
    const extraction: DrawingImportPageExtraction = {
      ...input.page.localExtraction,
      classification: 'duplicate',
      route: 'local',
      warnings: [...input.page.localExtraction.warnings, `Exact duplicate of page ${duplicate.sourcePageNumber} from ${duplicate.sourceFilename}.`],
    };
    await updateDrawingImportPageResult({
      pageId: input.page.id,
      extraction,
      reviewStatus: 'ACCEPTED',
      routeTier: 'local',
      duplicateOfPageId: duplicate.id,
    });
    return extraction;
  }

  if (['bom', 'cover_sheet', 'reference'].includes(input.page.localExtraction.classification)) {
    await updateDrawingImportPageResult({
      pageId: input.page.id,
      extraction: input.page.localExtraction,
      reviewStatus: 'ACCEPTED',
      routeTier: 'local',
    });
    return input.page.localExtraction;
  }

  const criticalFields: DrawingImportFieldName[] = ['partNumber', 'drawingQuantity', 'material', 'revision'];
  const canBypassAi = !config.directPdfV3Enabled
    && input.page.localExtraction.classification !== 'uncertain'
    && criticalFields.every((field) => input.page.localExtraction.autoAcceptedFields.includes(field) || field === 'revision');
  if (canBypassAi || !input.adapter) {
    const extraction = input.page.localExtraction;
    const reviewStatus = canDrawingImportPageCreatePart(extraction) && drawingImportExtractionNeedsHumanReview(extraction)
      ? 'MANUAL_REVIEW'
      : extraction.classification === 'uncertain' ? 'MANUAL_REVIEW' : 'ACCEPTED';
    await updateDrawingImportPageResult({ pageId: input.page.id, extraction, reviewStatus, routeTier: 'local' });
    return extraction;
  }

  const baseContext = {
    jobId: input.job.id,
    pageId: input.page.id,
    pageHash: sha256Hex(input.page.canonicalPdf),
    profileVersion: 'none',
    sourceFilename: input.page.sourceFilename,
    sourcePageNumber: input.page.sourcePageNumber,
    unresolvedFields: DRAWING_IMPORT_FIELD_NAMES.filter((name) => !input.page.localExtraction.autoAcceptedFields.includes(name)),
    coordinateAwareText: coordinateTextForModel(input.page),
    localCandidates: localCandidates(input.page.localExtraction),
    bomCandidates: bomCandidatesForPage(input.page, input.rows),
    fullPageImageDataUrl: input.page.sourceImage
      ? `data:${input.page.sourceImage.mimeType};base64,${input.page.sourceImage.bytes.toString('base64')}`
      : undefined,
  };

  let current = input.page.localExtraction;
  let latestAi: DrawingImportAiExtraction | null = null;
  let latestRoute: 'terra_targeted' | 'terra_full_page' | 'terra_refinement' | 'sol_escalation' = 'terra_full_page';
  const cropRegion = unionEvidenceRegion(current);
  if (!config.directPdfV3Enabled && cropRegion) {
    const crop = await cropPreview(input.page.preview, cropRegion);
    const storedCrop = await storeDerived({
      business: safeBusiness(input.job.business),
      customerName: input.job.customerName,
      draftReference: input.job.draftReference,
      filename: `${filenameWithoutExtension(input.page.sourceFilename)}-page-${input.page.sourcePageNumber}-title-crop.png`,
      bytes: crop.bytes,
      rootDir: input.rootDir,
    });
    const cached = await completedAiAttempt(input.page.id, 'terra_targeted');
    const sequence = await nextAttemptSequence(input.page.id, 'terra_targeted');
    const result = cached ? null : await input.stageGates.targeted.run(() => input.adapter!.runTerraTargeted({
      ...baseContext,
      attemptId: `targeted-${sequence}`,
      knownRegionIds: [storedCrop.storagePath],
      titleCropDataUrl: `data:image/png;base64,${crop.bytes.toString('base64')}`,
      titleCropId: storedCrop.storagePath,
    }));
    latestAi = cached ?? result?.extraction ?? null;
    if (result) {
      await createDrawingExtractionAttempt({
        pageId: input.page.id,
        stage: 'ai_resolution',
        sourceType: 'model',
        routeTier: 'terra_targeted',
        idempotencyKey: `${input.job.id}:${input.page.id}:terra_targeted:${sequence}`,
        promptVersion: DRAWING_IMPORT_AI_PROMPT_VERSION,
        usage: result.usage,
        result: result.extraction,
        warnings: result.errorCode ? [result.errorCode] : [],
        errorSummary: result.errorCode === 'request_failed' ? 'Terra targeted request failed.' : null,
      });
    }
    if (latestAi) {
      current = mergeDrawingImportAiExtraction({ local: current, ai: latestAi, page: input.page.text, route: 'terra_targeted', cropId: storedCrop.storagePath, cropRegion });
      latestRoute = 'terra_targeted';
    }
  }

  if (config.directPdfV3Enabled || !latestAi || current.classification === 'uncertain' || drawingImportExtractionNeedsHumanReview(current)) {
    const cached = await completedAiAttempt(input.page.id, 'terra_full_page');
    const sequence = await nextAttemptSequence(input.page.id, 'terra_full_page');
    const result = cached ? null : await input.stageGates.fullPage.run(() => input.adapter!.runTerraFullPage({
      ...baseContext,
      attemptId: `full-${sequence}`,
      knownRegionIds: [],
      canonicalPagePdf: input.page.canonicalPdf,
    }));
    latestAi = cached ?? result?.extraction ?? latestAi;
    if (result) {
      await createDrawingExtractionAttempt({
        pageId: input.page.id,
        stage: 'ai_resolution',
        sourceType: 'model',
        routeTier: 'terra_full_page',
        idempotencyKey: `${input.job.id}:${input.page.id}:terra_full_page:${sequence}`,
        promptVersion: DRAWING_IMPORT_AI_PROMPT_VERSION,
        usage: result.usage,
        result: result.extraction,
        warnings: result.errorCode ? [result.errorCode] : [],
        errorSummary: result.errorCode === 'request_failed' ? 'Terra full-page request failed.' : null,
      });
    }
    if (latestAi) {
      current = mergeDrawingImportAiExtraction({
        local: current,
        ai: latestAi,
        page: input.page.text,
        route: 'terra_full_page',
        preferModel: config.directPdfV3Enabled,
      });
      latestRoute = 'terra_full_page';
    } else if (config.directPdfV3Enabled) {
      current = {
        ...current,
        classification: 'uncertain',
        route: 'terra_full_page',
        warnings: [...current.warnings, 'The full-page Terra request did not complete; this page requires manual review or reprocessing.'],
      };
      latestRoute = 'terra_full_page';
    }
  }

  const dimensionFields = ['finalLength', 'partWidth', 'partThickness'] as const;
  const unresolvedDimensions = config.directPdfV3Enabled
    && latestAi
    && !input.page.sourceImage
    && current.classification === 'part_drawing'
    ? dimensionFields.filter((field) => current[field].value === null || ['unreadable', 'conflicting'].includes(current[field].status))
    : [];
  if (unresolvedDimensions.length) {
    const cached = await completedAiAttempt(input.page.id, 'terra_refinement');
    const sequence = await nextAttemptSequence(input.page.id, 'terra_refinement');
    const result = cached ? null : await input.stageGates.fullPage.run(() => input.adapter!.runTerraDimensionRefinement({
      ...baseContext,
      attemptId: `terra-refinement-${sequence}`,
      unresolvedFields: unresolvedDimensions,
      knownRegionIds: [],
      canonicalPagePdf: input.page.canonicalPdf,
      escalationReasons: [`manufacturing_dimensions_unresolved:${unresolvedDimensions.join(',')}`],
    }));
    const refinement = cached ?? result?.extraction ?? null;
    if (result) {
      await createDrawingExtractionAttempt({
        pageId: input.page.id,
        stage: 'ai_resolution',
        sourceType: 'model',
        routeTier: 'terra_refinement',
        idempotencyKey: `${input.job.id}:${input.page.id}:terra_refinement:${sequence}`,
        promptVersion: DRAWING_IMPORT_AI_PROMPT_VERSION,
        usage: result.usage,
        result: result.extraction,
        warnings: [
          `manufacturing_dimensions_unresolved:${unresolvedDimensions.join(',')}`,
          ...(result.errorCode ? [result.errorCode] : []),
        ],
        errorSummary: result.errorCode === 'request_failed' ? 'Terra dimension refinement request failed.' : null,
      });
    }
    if (refinement) {
      current = mergeDrawingImportAiExtraction({
        local: current,
        ai: refinement,
        page: input.page.text,
        route: 'terra_refinement',
        preferModel: true,
        fieldsToReplace: unresolvedDimensions,
      });
      latestAi = refinement;
      latestRoute = 'terra_refinement';
    }
  }

  if (latestAi) {
    const escalation = decideDrawingImportSolEscalation({
      terraResult: latestAi,
      solEscalationEnabled: config.solEscalationEnabled,
      contradictsStrongLocalEvidence: hasStrongLocalContradiction(input.page.localExtraction, latestAi),
      ambiguousBomMatches: current.warnings.some((warning) => warning.toLowerCase().includes('ambiguous')),
      poorOrUnusualPage: input.page.text.rawText.trim().length < 24,
    });
    if (escalation.escalate) {
      const cached = await completedAiAttempt(input.page.id, 'sol_escalation');
      const sequence = await nextAttemptSequence(input.page.id, 'sol_escalation');
      const result = cached ? null : await input.stageGates.sol.run(() => input.adapter!.runSolEscalation({
        ...baseContext,
        attemptId: `sol-${sequence}`,
        knownRegionIds: [],
        canonicalPagePdf: input.page.canonicalPdf,
        escalationReasons: escalation.reasons,
      }));
      const sol = cached ?? result?.extraction ?? null;
      if (result) {
        await createDrawingExtractionAttempt({
          pageId: input.page.id,
          stage: 'ai_resolution',
          sourceType: 'model',
          routeTier: 'sol_escalation',
          idempotencyKey: `${input.job.id}:${input.page.id}:sol_escalation:${sequence}`,
          promptVersion: DRAWING_IMPORT_AI_PROMPT_VERSION,
          usage: result.usage,
          result: result.extraction,
          warnings: [...escalation.reasons, ...(result.errorCode ? [result.errorCode] : [])],
          errorSummary: result.errorCode === 'request_failed' ? 'Sol escalation request failed.' : null,
        });
      }
      if (sol) {
        current = mergeDrawingImportAiExtraction({
          local: current,
          ai: sol,
          page: input.page.text,
          route: 'sol_escalation',
          preferModel: config.directPdfV3Enabled,
        });
        latestRoute = 'sol_escalation';
      }
    }
  }

  const reviewStatus = canDrawingImportPageCreatePart(current)
    ? drawingImportExtractionNeedsHumanReview(current) ? 'MANUAL_REVIEW' : 'ACCEPTED'
    : current.classification === 'uncertain' ? 'MANUAL_REVIEW' : 'ACCEPTED';
  await updateDrawingImportPageResult({ pageId: input.page.id, extraction: current, reviewStatus, routeTier: latestRoute });
  await setDrawingImportJobState({ jobId: input.job.id, actualCostUsd: input.budget.snapshot().actualCostUsd, firstPageReady: true });
  return current;
}

function normalizePartNumber(value: string | null | undefined) {
  return value?.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '') ?? '';
}

function multipliedDrawingQuantityField(input: {
  pageId: string;
  base: DrawingImportFieldValue<number>;
  multiplier: number;
}): DrawingImportFieldValue<number> {
  const baseQuantity = input.base.value ?? 1;
  const quantity = baseQuantity * input.multiplier;
  return {
    value: quantity,
    rawText: input.base.rawText ?? String(baseQuantity),
    status: input.multiplier > 1 ? 'derived_locally' : input.base.status,
    evidence: [{
      sourceType: input.base.evidence[0]?.sourceType ?? 'embedded_text',
      sourcePageId: input.base.evidence[0]?.sourcePageId ?? input.pageId,
      sourceRegion: input.base.evidence[0]?.sourceRegion ?? null,
      sourceCropId: null,
      rawText: input.base.rawText ?? String(baseQuantity),
      parser: 'quote_assembly_multiplier_v2',
      agreementSignals: ['reviewed_drawing_quantity'],
      warnings: [],
      derivedFrom: [
        { field: 'drawingQuantity', value: String(baseQuantity) },
        { field: 'rootMultiplier', value: String(input.multiplier) },
      ],
    }],
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}

async function applyFinalQuantities(input: {
  job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>;
  pages: ProcessedPage[];
  extractions: Map<string, DrawingImportPageExtraction>;
  rows: DrawingBomRow[];
}) {
  const partPages = input.pages.flatMap((page) => {
    const extraction = input.extractions.get(page.id);
    return extraction && canDrawingImportPageCreatePart(extraction) ? [{ page, extraction }] : [];
  });
  const nodes: AssemblyGraphNode[] = partPages.map(({ page, extraction }) => ({
    id: page.id,
    pageId: page.id,
    partNumber: extraction.partNumber.value,
    revision: extraction.revision.value,
  }));
  const pagesByPartNumber = new Map<string, typeof partPages>();
  for (const entry of partPages) {
    const key = normalizePartNumber(entry.extraction.partNumber.value);
    if (!key) continue;
    pagesByPartNumber.set(key, [...(pagesByPartNumber.get(key) ?? []), entry]);
  }
  const assemblyPages = partPages.filter(({ extraction }) => extraction.classification === 'assembly_drawing');
  const edges: AssemblyGraphEdge[] = [];
  const persistedEdges: Array<{
    bomRowId: string;
    parentPageId: string | null;
    childPageId: string | null;
    quantityPerParent: number | null;
    status: string;
    warnings: string[];
  }> = [];
  for (const row of input.rows) {
    const childMatches = pagesByPartNumber.get(normalizePartNumber(row.partNumber.value)) ?? [];
    const explicitParents = pagesByPartNumber.get(normalizePartNumber(row.parentAssemblyPartNumber.value)) ?? [];
    const parentMatches = explicitParents.length ? explicitParents : assemblyPages.length === 1 ? assemblyPages : [];
    const childPageId = childMatches.length === 1 ? childMatches[0].page.id : null;
    const parentPageId = parentMatches.length === 1 ? parentMatches[0].page.id : null;
    const quantityPerParent = row.quantityPerParent.value;
    const warnings = [...row.warnings];
    if (childMatches.length !== 1) warnings.push(childMatches.length ? 'BOM child matches multiple drawing pages.' : 'BOM child drawing was not found.');
    if (parentMatches.length !== 1) warnings.push(parentMatches.length ? 'BOM parent matches multiple assembly pages.' : 'BOM parent assembly was not established.');
    const status = childPageId && parentPageId && quantityPerParent ? 'matched' : 'unresolved';
    persistedEdges.push({ bomRowId: row.id, parentPageId, childPageId, quantityPerParent, status, warnings });
    if (parentPageId) {
      edges.push({
        id: row.id,
        bomRowId: row.id,
        parentNodeId: parentPageId,
        childNodeId: childPageId,
        quantityPerParent,
        sourcePageId: row.sourcePageId,
        sourceRegion: row.sourceRegion,
        sourceFingerprint: `${row.sourcePageId}:${row.rowIndex}`,
      });
    }
  }
  await replaceDrawingImportBomEdges(persistedEdges);

  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) if (edge.childNodeId) indegree.set(edge.childNodeId, (indegree.get(edge.childNodeId) ?? 0) + 1);
  const roots = assemblyPages
    .filter(({ page }) => (indegree.get(page.id) ?? 0) === 0)
    .map(({ page }) => ({ nodeId: page.id, quantity: input.job.assemblyMultiplier }));
  const graph = calculateAssemblyQuantities({
    mode: input.job.intakeMode,
    nodes,
    edges,
    roots,
    oneOffQuantities: partPages.map(({ page, extraction }) => ({ nodeId: page.id, quantity: extraction.drawingQuantity })),
  });
  const graphQuantities = new Map(graph.resolutions.map((resolution) => [resolution.nodeId, resolution.quantity]));

  for (const page of input.pages) {
    const extraction = input.extractions.get(page.id);
    if (!extraction || !canDrawingImportPageCreatePart(extraction)) continue;
    const partNumber = normalizePartNumber(extraction.partNumber.value);
    const matchingRows = input.rows.filter((row) => normalizePartNumber(row.partNumber.value) === partNumber);
    const unambiguousRow = matchingRows.length === 1 ? matchingRows[0] : undefined;
    const graphQuantity = graphQuantities.get(page.id);
    if (input.job.intakeMode === 'ONE_OFF') extraction.drawingQuantity = graphQuantity ?? extraction.drawingQuantity;
    else if (edges.length) {
      if (graphQuantity?.value) extraction.drawingQuantity = graphQuantity;
      else {
        extraction.drawingQuantity.status = 'conflicting';
        extraction.drawingQuantity.warnings.push('The assembly graph could not establish this part quantity. Confirm it before saving.');
      }
    } else {
      extraction.drawingQuantity = multipliedDrawingQuantityField({
        pageId: page.id,
        base: extraction.drawingQuantity,
        multiplier: input.job.assemblyMultiplier,
      });
    }
    if (!extraction.material.value && unambiguousRow?.material.value) {
      extraction.material = {
        ...unambiguousRow.material,
        status: 'derived_from_bom',
        evidence: unambiguousRow.material.evidence.map((entry) => ({ ...entry, sourceType: 'bom' as const })),
      };
    }
    if (matchingRows.length > 1) {
      extraction.drawingQuantity.status = 'conflicting';
      extraction.drawingQuantity.warnings.push('Multiple BOM rows match this part number; confirm the required quantity.');
    }
    const quantityWarnings = graph.resolutions.find((resolution) => resolution.nodeId === page.id)?.warnings ?? [];
    extraction.drawingQuantity.warnings.push(...quantityWarnings);
    extraction.warnings.push(...graph.warnings);
    const reviewStatus = drawingImportExtractionNeedsHumanReview(extraction) ? 'MANUAL_REVIEW' : 'ACCEPTED';
    await updateDrawingImportPageResult({
      pageId: page.id,
      extraction,
      reviewStatus,
      routeTier: extraction.route,
      warnings: extraction.warnings,
    });
  }
}

async function currentJobCounts(jobId: string) {
  const pages = await listDrawingImportPageStatuses(jobId);
  return {
    totalPages: pages.length,
    completedPages: pages.filter((page) => page.reviewStatus !== 'PENDING').length,
    locallyAcceptedPages: pages.filter((page) => page.routeTier === 'local' && page.reviewStatus === 'ACCEPTED').length,
    terraProcessedPages: pages.filter((page) => page.routeTier.startsWith('terra_')).length,
    solEscalatedPages: pages.filter((page) => page.routeTier === 'sol_escalation').length,
    manualReviewPages: pages.filter((page) => page.reviewStatus === 'MANUAL_REVIEW').length,
    failedPages: pages.filter((page) => page.reviewStatus === 'FAILED').length,
  };
}

async function processQuoteDrawingImportV2Job(jobId: string) {
  let claimed = await claimQueuedDrawingImportJob(jobId);
  if (!claimed) claimed = await claimStaleDrawingImportJob(jobId, new Date(Date.now() - STALE_JOB_MS));
  if (!claimed) return;
  const stopHeartbeat = startDrawingImportJobHeartbeat(jobId);
  const startedAt = Date.now();
  try {
    let job = await findDrawingImportJobById(jobId);
    if (!job) throw new Error('Drawing import job not found.');
    if (!['quote', 'order'].includes(job.destination)) throw new Error('Unsupported drawing import destination.');
    const settings = await getAppSettings();
    await touchDrawingImportJob(jobId, 'inventory');
    const drawings = await inventoryJobSources(job, settings.attachmentsDir);
    if (!drawings.length) throw new Error('No supported drawing files were found.');
    if (await isDrawingImportCancellationRequested(jobId)) {
      await setDrawingImportJobState({ jobId, status: 'CANCELLED', stage: 'complete', completed: true });
      return;
    }

    job = await findDrawingImportJobById(jobId);
    if (!job) throw new Error('Drawing import job disappeared.');
    await touchDrawingImportJob(jobId, 'document_analysis');
    const config = getDrawingImportV2Config();
    config.solEscalationEnabled = settings.drawingImportLunaFallbackEnabled;
    const sourceResults = await mapWithConcurrency(drawings, config.pdfWorkerConcurrency, async (drawing) => {
      try {
        return await analyzeDrawingSource({ job: job!, drawing, rootDir: settings.attachmentsDir });
      } catch (error) {
        console.error('[DrawingImportV2] document analysis failed', {
          jobId,
          stage: 'document_analysis',
          filename: drawing.filename,
          error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
        });
        return { error: error instanceof Error ? `${drawing.filename}: ${error.message}` : `${drawing.filename}: analysis failed` } as const;
      }
    });
    const documentErrors = sourceResults.flatMap((result) => Array.isArray(result) ? [] : [result.error]);
    const pages = sourceResults.flatMap((result) => Array.isArray(result) ? result : []);
    await setDrawingImportJobState({ jobId, counts: { totalPages: pages.length }, timing: { inventoryAndDocumentsMs: Date.now() - startedAt } });
    if (!pages.length) throw new Error(documentErrors[0] ?? 'No drawing pages could be prepared.');

    await touchDrawingImportJob(jobId, 'bom_analysis');
    const bomRows = await parseAndPersistBoms(jobId, pages);
    await touchDrawingImportJob(jobId, 'local_resolution');

    const budget = new DrawingImportAiBudgetController(job.softBudgetUsd, job.hardBudgetUsd, job.actualCostUsd);
    const adapter = process.env.OPENAI_API_KEY?.trim()
      ? createDrawingImportAiAdapter({
          responses: createOpenAiDrawingImportResponsesPort(new OpenAI({ apiKey: process.env.OPENAI_API_KEY })),
          settings: getDrawingImportAiSettings(),
          runtime: config,
          pricing: DEFAULT_DRAWING_IMPORT_PRICING_CATALOG,
          budget,
        })
      : null;
    await touchDrawingImportJob(jobId, 'ai_resolution');
    const resolved = new Map<string, DrawingImportPageExtraction>();
    const stageGates = {
      targeted: createDrawingImportConcurrencyGate(config.targetedAiConcurrency),
      fullPage: createDrawingImportConcurrencyGate(config.fullPageAiConcurrency),
      sol: createDrawingImportConcurrencyGate(config.solAiConcurrency),
    };
    const pagePipelineConcurrency = Math.max(
      config.targetedAiConcurrency,
      config.fullPageAiConcurrency,
      config.solAiConcurrency,
    );
    await mapWithConcurrency(pages, pagePipelineConcurrency, async (page) => {
      if (await isDrawingImportCancellationRequested(jobId)) return;
      try {
        const extraction = await resolvePageWithAi({ job: job!, page, rows: bomRows, rootDir: settings.attachmentsDir, adapter, config, budget, stageGates });
        resolved.set(page.id, extraction);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Page processing failed.';
        await markDrawingImportPageFailed(page.id, message);
      }
      await setDrawingImportJobState({ jobId, counts: await currentJobCounts(jobId), actualCostUsd: budget.snapshot().actualCostUsd });
    });

    if (await isDrawingImportCancellationRequested(jobId)) {
      await setDrawingImportJobState({ jobId, status: 'CANCELLED', stage: 'complete', counts: await currentJobCounts(jobId), actualCostUsd: budget.snapshot().actualCostUsd, completed: true });
      return;
    }
    await touchDrawingImportJob(jobId, 'final_validation');
    await applyFinalQuantities({ job, pages, extractions: resolved, rows: bomRows });
    const counts = await currentJobCounts(jobId);
    const partialFailure = counts.failedPages > 0 || documentErrors.length > 0;
    await setDrawingImportJobState({
      jobId,
      status: partialFailure ? 'PARTIAL_FAILURE' : 'READY_FOR_REVIEW',
      stage: 'ready_for_review',
      counts,
      actualCostUsd: budget.snapshot().actualCostUsd,
      errorSummary: documentErrors.length ? documentErrors.join('\n').slice(0, 4000) : null,
      timing: { totalProcessingMs: Date.now() - startedAt },
      completed: true,
    });
  } catch (error) {
    console.error('[DrawingImportV2] job failed', {
      jobId,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });
    await setDrawingImportJobState({
      jobId,
      status: 'FAILED',
      stage: 'complete',
      errorSummary: error instanceof Error ? error.message : 'Drawing import failed.',
      completed: true,
    }).catch(() => undefined);
  } finally {
    await stopHeartbeat();
  }
}

export function ensureQuoteDrawingImportV2JobProcessing(jobId: string) {
  if (activeJobs.has(jobId)) return;
  const operation = processQuoteDrawingImportV2Job(jobId).finally(() => activeJobs.delete(jobId));
  activeJobs.set(jobId, operation);
}

function attachmentFile(storagePath: string | null, label: string, mimeType: string) {
  return storagePath ? { storagePath, label, mimeType } : null;
}

function pageArtifactHref(jobId: string, pageId: string, kind: 'canonical' | 'preview' | 'source') {
  return `/api/admin/quotes/drawing-import-v2/${encodeURIComponent(jobId)}/pages/${encodeURIComponent(pageId)}/artifact?kind=${kind}`;
}

function serializeReviewPage(job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>, page: (typeof job.pages)[number]) {
  const parsedExtraction = parseJson<DrawingImportPageExtraction | null>(page.finalExtractionJson ?? page.localExtractionJson, null);
  const extraction = parsedExtraction ? normalizeDrawingImportPageExtraction(parsedExtraction) : null;
  const warnings = parseJson<string[]>(page.warningsJson, []);
  const sourcePageCount = job.sources.find((source) => source.id === page.sourceId)?.pageCount ?? 1;
  const processingStatus = page.reviewStatus === 'FAILED'
    ? 'failed'
    : page.reviewStatus === 'PENDING'
      ? job.status === 'PROCESSING' ? 'processing' : 'queued'
      : 'ready';
  return {
    pageId: page.id,
    filename: page.sourceFilename,
    sourcePageNumber: page.sourcePageNumber,
    sourcePageCount,
    classification: page.classification as DrawingImportPageClassification,
    processingStatus,
    extraction,
    exactPageHref: page.canonicalPdfStoragePath ? pageArtifactHref(job.id, page.id, 'canonical') : null,
    originalPacketHref: pageArtifactHref(job.id, page.id, 'source'),
    previewUrl: page.previewStoragePath ? pageArtifactHref(job.id, page.id, 'preview') : null,
    canonicalSource: attachmentFile(page.canonicalPdfStoragePath, `${filenameWithoutExtension(page.sourceFilename)} page ${page.sourcePageNumber}.pdf`, 'application/pdf'),
    originalPacketSource: attachmentFile(page.source.storagePath, page.source.originalFilename, page.source.originalFilename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
    error: page.reviewStatus === 'FAILED' ? warnings[0] ?? 'Page processing failed.' : null,
    warnings,
  };
}

export async function getQuoteDrawingImportV2JobSnapshot(jobId: string) {
  const job = await findDrawingImportJobById(jobId);
  if (!job) throw new Error('Drawing import job not found.');
  if (!['quote', 'order'].includes(job.destination)) throw new Error('Unsupported drawing import destination.');
  if (['QUEUED', 'PROCESSING'].includes(job.status)) ensureQuoteDrawingImportV2JobProcessing(job.id);
  return {
    progress: toDrawingImportJobProgress(job),
    pages: job.pages.map((page) => serializeReviewPage(job, page)),
    supportingFiles: job.sources
      .filter((source) => source.sourceKind === 'archive' || source.sourceKind === 'supporting_solidworks')
      .map((source) => ({ storagePath: source.storagePath, label: source.originalFilename, mimeType: source.mimeType })),
  };
}

export async function cancelQuoteDrawingImportV2Job(jobId: string) {
  await requestDrawingImportCancellation(jobId);
  if (!activeJobs.has(jobId)) {
    await setDrawingImportJobState({ jobId, status: 'CANCELLED', stage: 'complete', completed: true });
  }
  return getQuoteDrawingImportV2JobSnapshot(jobId);
}

export async function reprocessQuoteDrawingImportV2Page(jobId: string, pageId: string) {
  const page = await findDrawingImportPageForJob(jobId, pageId);
  if (!page) throw new Error('Drawing page not found.');
  await resetDrawingImportPageForReprocess(pageId);
  await queueDrawingImportJob(jobId);
  ensureQuoteDrawingImportV2JobProcessing(jobId);
  return getQuoteDrawingImportV2JobSnapshot(jobId);
}

function correctedField<T extends string | number | boolean>(input: {
  current: DrawingImportFieldValue<T>;
  value: T | null;
  pageId: string;
}): DrawingImportFieldValue<T> {
  return {
    ...input.current,
    value: input.value,
    rawText: input.value === null ? null : String(input.value),
    status: 'human_corrected',
    evidence: [{
      sourceType: 'human',
      sourcePageId: input.pageId,
      sourceRegion: null,
      sourceCropId: null,
      rawText: input.value === null ? null : String(input.value),
      parser: 'quote_review_v2',
      agreementSignals: [],
      warnings: [],
    }],
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}

export async function saveQuoteDrawingImportV2FieldCorrection(input: {
  jobId: string;
  pageId: string;
  field: DrawingImportFieldName;
  value: string | number | boolean | null;
}) {
  const page = await findDrawingImportPageForJob(input.jobId, input.pageId);
  if (!page) throw new Error('Drawing page not found.');
  const parsedExtraction = parseJson<DrawingImportPageExtraction | null>(page.finalExtractionJson ?? page.localExtractionJson, null);
  const extraction = parsedExtraction ? normalizeDrawingImportPageExtraction(parsedExtraction) : null;
  if (!extraction) throw new Error('This page does not have a reviewable extraction yet.');
  if (input.field === 'drawingQuantity') {
    const value = input.value === null ? null : Number(input.value);
    if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw new Error('Quantity must be a positive whole number.');
    extraction.drawingQuantity = correctedField({ current: extraction.drawingQuantity, value, pageId: input.pageId });
  } else if (input.field === 'assemblyStatus') {
    if (input.value !== null && typeof input.value !== 'boolean') throw new Error('Assembly status must be true or false.');
    const value = input.value as boolean | null;
    extraction.assemblyStatus = correctedField({ current: extraction.assemblyStatus, value, pageId: input.pageId });
  } else {
    const value = input.value === null ? null : String(input.value).trim();
    (extraction[input.field] as DrawingImportFieldValue<string>) = correctedField({
      current: extraction[input.field] as DrawingImportFieldValue<string>,
      value,
      pageId: input.pageId,
    });
  }
  await recordHumanDrawingImportCorrection({
    pageId: input.pageId,
    extraction,
    idempotencyKey: `${input.jobId}:${input.pageId}:human:${input.field}:${randomUUID()}`,
  });
  const snapshot = await getQuoteDrawingImportV2JobSnapshot(input.jobId);
  return snapshot.pages.find((candidate) => candidate.pageId === input.pageId)!;
}

export async function saveQuoteDrawingImportV2Classification(input: {
  jobId: string;
  pageId: string;
  classification: DrawingImportPageClassification;
}) {
  const page = await findDrawingImportPageForJob(input.jobId, input.pageId);
  if (!page) throw new Error('Drawing page not found.');
  const parsedExtraction = parseJson<DrawingImportPageExtraction | null>(page.finalExtractionJson ?? page.localExtractionJson, null);
  const extraction = parsedExtraction ? normalizeDrawingImportPageExtraction(parsedExtraction) : null;
  if (!extraction) throw new Error('This page does not have a reviewable extraction yet.');
  extraction.classification = input.classification;
  extraction.route = 'human';
  await recordHumanDrawingImportCorrection({
    pageId: input.pageId,
    extraction,
    idempotencyKey: `${input.jobId}:${input.pageId}:human:classification:${randomUUID()}`,
  });
  await updateDrawingImportPageClassification(input.pageId, input.classification);
  const snapshot = await getQuoteDrawingImportV2JobSnapshot(input.jobId);
  return snapshot.pages.find((candidate) => candidate.pageId === input.pageId)!;
}

export async function resolveQuoteDrawingImportV2Artifact(input: {
  jobId: string;
  pageId: string;
  kind: 'canonical' | 'preview' | 'source' | 'crop';
  cropStoragePath?: string | null;
}) {
  const page = await findDrawingImportPageForJob(input.jobId, input.pageId);
  if (!page) throw new Error('Drawing page not found.');
  let storagePath: string | null = null;
  let mimeType = 'application/octet-stream';
  let filename = page.sourceFilename;
  if (input.kind === 'canonical') {
    storagePath = page.canonicalPdfStoragePath;
    mimeType = 'application/pdf';
    filename = `${filenameWithoutExtension(page.sourceFilename)}-page-${page.sourcePageNumber}.pdf`;
  } else if (input.kind === 'preview') {
    storagePath = page.previewStoragePath;
    mimeType = 'image/png';
    filename = `${filenameWithoutExtension(page.sourceFilename)}-page-${page.sourcePageNumber}-preview.png`;
  } else if (input.kind === 'source') {
    storagePath = page.source.storagePath;
    mimeType = page.source.mimeType;
    filename = page.source.originalFilename;
  } else {
    const parsedExtraction = parseJson<DrawingImportPageExtraction | null>(page.finalExtractionJson ?? page.localExtractionJson, null);
    const extraction = parsedExtraction ? normalizeDrawingImportPageExtraction(parsedExtraction) : null;
    const allowed = extraction && DRAWING_IMPORT_FIELD_NAMES.some((field) => extraction[field].evidence.some((entry) => entry.sourceCropId === input.cropStoragePath));
    if (!allowed) throw new Error('Evidence crop not found.');
    storagePath = input.cropStoragePath ?? null;
    mimeType = 'image/png';
    filename = `${filenameWithoutExtension(page.sourceFilename)}-evidence.png`;
  }
  if (!storagePath) throw new Error('Drawing artifact not found.');
  const settings = await getAppSettings();
  return { bytes: await readStoredFile(storagePath, settings.attachmentsDir), mimeType, filename };
}



function unionEvidenceRegion(extraction: DrawingImportPageExtraction): DrawingImportNormalizedRegion | null {
  const regions = DRAWING_IMPORT_FIELD_NAMES
    .flatMap((field) => extraction[field].evidence.map((entry) => entry.sourceRegion))
    .filter((region): region is DrawingImportNormalizedRegion => Boolean(region));
  if (!regions.length) return null;
  const margin = 0.035;
  return [
    Math.max(0, Math.min(...regions.map((region) => region[0])) - margin),
    Math.max(0, Math.min(...regions.map((region) => region[1])) - margin),
    Math.min(1, Math.max(...regions.map((region) => region[2])) + margin),
    Math.min(1, Math.max(...regions.map((region) => region[3])) + margin),
  ];
}

function coordinateTextForModel(page: ProcessedPage) {
  return page.text.lines.map((line, index) => `${index + 1} [${line.region.map((value) => value.toFixed(4)).join(',')}]: ${line.text}`).join('\n');
}

function localCandidates(extraction: DrawingImportPageExtraction) {
  return DRAWING_IMPORT_FIELD_NAMES.map((name) => ({
    field: name,
    value: extraction[name].value,
    status: extraction[name].status,
    rawText: extraction[name].rawText,
    evidence: extraction[name].evidence.map((entry) => ({ rawText: entry.rawText, region: entry.sourceRegion, sourceType: entry.sourceType })),
  }));
}

function bomCandidatesForPage(page: ProcessedPage, rows: DrawingBomRow[]) {
  const partNumber = page.localExtraction.partNumber.value?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!partNumber) return rows.slice(0, 5).map((row) => row.rawCells);
  const exact = rows.filter((row) => row.partNumber.value?.toUpperCase().replace(/[^A-Z0-9]/g, '') === partNumber);
  return (exact.length ? exact : rows.slice(0, 5)).map((row) => ({
    item: row.item.value,
    partNumber: row.partNumber.value,
    description: row.description.value,
    quantityPerParent: row.quantityPerParent.value,
    material: row.material.value,
    revision: row.revision.value,
    sourcePageId: row.sourcePageId,
    sourceRegion: row.sourceRegion,
  }));
}
