import 'server-only';

import { prisma } from '@/lib/prisma';
import { createFileOnlyDrawingExtraction, drawingReviewStatus, hasHumanDrawingClassification, preserveHumanDrawingReview } from './drawing-import-review';
import { normalizeDrawingImportPageExtraction, type DrawingImportFieldName } from './drawing-import-v2.types';
import type {
  DrawingImportJobProgress,
  DrawingImportJobStage,
  DrawingImportJobStatus,
  DrawingImportPageExtraction,
  DrawingImportUsage,
} from './drawing-import-v2.types';

function json(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type StoredReviewPage = NonNullable<Awaited<ReturnType<typeof findDrawingImportPage>>>;
type ReviewWrite = {
  finalExtractionJson?: string;
  localExtractionJson?: string;
  reviewStatus?: string;
  routeTier?: string;
  classification?: string;
  classificationConfidence?: number;
  warningsJson?: string;
  duplicateOfPageId?: string | null;
};
/** Guarded writes prevent stale JSON; native batch transactions avoid holding SQLite locks across JS awaits. */
async function commitPageReview(
  pageId: string,
  change: (page: StoredReviewPage) => ReviewWrite,
  idempotencyKey?: string,
) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const current = await prisma.drawingImportPage.findUnique({ where: { id: pageId } });
    if (!current) throw new Error('Drawing page not found.');
    const data = change(current);
    try {
      const update = prisma.drawingImportPage.update({
        where: {
          id: pageId, finalExtractionJson: current.finalExtractionJson,
          localExtractionJson: current.localExtractionJson, classification: current.classification,
          reviewStatus: current.reviewStatus, routeTier: current.routeTier,
        },
        data,
      });
      if (!idempotencyKey) return await update;
      const [page] = await prisma.$transaction([
        update,
        prisma.drawingExtractionAttempt.create({ data: {
          pageId, stage: 'human_review', sourceType: 'human', routeTier: 'human',
          idempotencyKey, status: 'completed', resultJson: data.finalExtractionJson,
          warningsJson: data.warningsJson,
        } }),
      ]);
      return page;
    } catch (error) {
      // A failed guarded update rolls back its audit; re-read before applying the patch again.
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2025') throw error;
    }
  }
  throw new Error('This drawing is being updated. Your change was not saved; please try again.');
}

function storedExtraction(page: StoredReviewPage) {
  return parseJson<DrawingImportPageExtraction | null>(page.finalExtractionJson ?? page.localExtractionJson, null);
}

export type CreateDrawingImportJobInput = {
  idempotencyKey: string;
  createdById: string | null;
  destination: 'order' | 'quote';
  business: string;
  customerName: string;
  draftReference: string;
  intakeMode: 'ONE_OFF' | 'ASSEMBLY';
  assemblyMultiplier: number;
  pipelineVersion: string;
  mode: string;
  config: unknown;
  softBudgetUsd: number;
  hardBudgetUsd: number;
  source: {
    sourceKind: string;
    originalFilename: string;
    archivePath?: string | null;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    storagePath: string;
    pageCount?: number | null;
    warnings?: string[];
  };
};

export async function createDrawingImportJob(input: CreateDrawingImportJobInput) {
  return prisma.drawingImportJob.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      createdById: input.createdById,
      destination: input.destination,
      business: input.business,
      customerName: input.customerName,
      draftReference: input.draftReference,
      intakeMode: input.intakeMode,
      assemblyMultiplier: input.assemblyMultiplier,
      pipelineVersion: input.pipelineVersion,
      mode: input.mode,
      status: 'QUEUED',
      stage: 'queued',
      configJson: json(input.config),
      softBudgetUsd: input.softBudgetUsd,
      hardBudgetUsd: input.hardBudgetUsd,
      countsJson: json({ totalPages: 0 }),
      sources: {
        create: {
          sourceKind: input.source.sourceKind,
          originalFilename: input.source.originalFilename,
          archivePath: input.source.archivePath ?? null,
          mimeType: input.source.mimeType,
          sizeBytes: input.source.sizeBytes,
          sha256: input.source.sha256,
          storagePath: input.source.storagePath,
          pageCount: input.source.pageCount ?? null,
          warningsJson: json(input.source.warnings ?? []),
        },
      },
    },
    include: { sources: true },
  });
}

export async function findDrawingImportJobById(jobId: string) {
  return prisma.drawingImportJob.findUnique({
    where: { id: jobId },
    include: {
      sources: { orderBy: { createdAt: 'asc' } },
      pages: {
        orderBy: [{ source: { createdAt: 'asc' } }, { sourcePageNumber: 'asc' }],
        include: {
          source: { select: { originalFilename: true, storagePath: true } },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
    },
  });
}

export async function findDrawingImportJobForAdmin(jobId: string) {
  return findDrawingImportJobById(jobId);
}

export async function findDrawingImportJobByIdempotencyKey(idempotencyKey: string) {
  return prisma.drawingImportJob.findUnique({ where: { idempotencyKey }, include: { sources: true } });
}

export async function claimQueuedDrawingImportJob(jobId: string) {
  const result = await prisma.drawingImportJob.updateMany({
    where: { id: jobId, status: 'QUEUED', cancelRequestedAt: null },
    data: {
      status: 'PROCESSING',
      stage: 'inventory',
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      errorSummary: null,
    },
  });
  return result.count === 1;
}

export async function claimStaleDrawingImportJob(jobId: string, staleBefore: Date) {
  const result = await prisma.drawingImportJob.updateMany({
    where: {
      id: jobId,
      status: 'PROCESSING',
      cancelRequestedAt: null,
      OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }],
    },
    data: { lastHeartbeatAt: new Date(), errorSummary: null },
  });
  return result.count === 1;
}

export async function touchDrawingImportJob(jobId: string, stage?: DrawingImportJobStage) {
  return prisma.drawingImportJob.update({
    where: { id: jobId },
    data: { lastHeartbeatAt: new Date(), ...(stage ? { stage } : {}) },
  });
}

export async function setDrawingImportJobState(input: {
  jobId: string;
  status?: DrawingImportJobStatus;
  stage?: DrawingImportJobStage;
  counts?: Record<string, number>;
  timing?: Record<string, unknown>;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  errorSummary?: string | null;
  firstPageReady?: boolean;
  completed?: boolean;
}) {
  return prisma.drawingImportJob.update({
    where: { id: input.jobId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.counts ? { countsJson: json(input.counts) } : {}),
      ...(input.timing ? { timingJson: json(input.timing) } : {}),
      ...(input.estimatedCostUsd !== undefined ? { estimatedCostUsd: input.estimatedCostUsd } : {}),
      ...(input.actualCostUsd !== undefined ? { actualCostUsd: input.actualCostUsd } : {}),
      ...(input.errorSummary !== undefined ? { errorSummary: input.errorSummary } : {}),
      ...(input.firstPageReady ? { firstPageReadyAt: new Date() } : {}),
      ...(input.completed ? { completedAt: new Date() } : {}),
      lastHeartbeatAt: new Date(),
    },
  });
}

export async function requestDrawingImportCancellation(jobId: string) {
  return prisma.drawingImportJob.updateMany({
    where: { id: jobId, status: { in: ['QUEUED', 'PROCESSING'] } },
    data: { status: 'CANCEL_REQUESTED', cancelRequestedAt: new Date() },
  });
}

export async function isDrawingImportCancellationRequested(jobId: string) {
  const job = await prisma.drawingImportJob.findUnique({
    where: { id: jobId },
    select: { cancelRequestedAt: true, status: true },
  });
  return Boolean(job?.cancelRequestedAt) || job?.status === 'CANCEL_REQUESTED' || job?.status === 'CANCELLED';
}

export type CreateDrawingImportSourceInput = {
  sourceKind: string;
  originalFilename: string;
  archivePath?: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  pageCount?: number | null;
  warnings?: string[];
};

export async function createDrawingImportSource(jobId: string, input: CreateDrawingImportSourceInput) {
  return prisma.drawingImportSource.create({
    data: {
      jobId,
      sourceKind: input.sourceKind,
      originalFilename: input.originalFilename,
      archivePath: input.archivePath ?? null,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      storagePath: input.storagePath,
      pageCount: input.pageCount ?? null,
      warningsJson: json(input.warnings ?? []),
    },
  });
}

export async function findDrawingImportSource(jobId: string, input: { archivePath?: string | null; sha256: string }) {
  return prisma.drawingImportSource.findFirst({
    where: {
      jobId,
      sha256: input.sha256,
      archivePath: input.archivePath ?? null,
    },
  });
}

export async function updateDrawingImportSourcePageCount(sourceId: string, pageCount: number) {
  return prisma.drawingImportSource.update({ where: { id: sourceId }, data: { pageCount } });
}

export type CreateDrawingImportPageInput = {
  sourcePageNumber: number;
  sourceFilename: string;
  canonicalPdfStoragePath?: string | null;
  previewStoragePath?: string | null;
  contentSha256: string;
  perceptualHash?: string | null;
  width: number;
  height: number;
  rotation?: number;
  classification?: string;
  classificationConfidence?: number;
  localExtraction?: unknown;
  warnings?: string[];
};

export async function createDrawingImportPage(jobId: string, sourceId: string, input: CreateDrawingImportPageInput) {
  return prisma.drawingImportPage.create({
    data: {
      jobId,
      sourceId,
      sourcePageNumber: input.sourcePageNumber,
      sourceFilename: input.sourceFilename,
      canonicalPdfStoragePath: input.canonicalPdfStoragePath ?? null,
      previewStoragePath: input.previewStoragePath ?? null,
      contentSha256: input.contentSha256,
      perceptualHash: input.perceptualHash ?? null,
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? 0,
      classification: input.classification ?? 'uncertain',
      classificationConfidence: input.classificationConfidence ?? 0,
      localExtractionJson: input.localExtraction === undefined ? null : json(input.localExtraction),
      warningsJson: json(input.warnings ?? []),
    },
  });
}

export async function findDrawingImportPage(sourceId: string, sourcePageNumber: number) {
  return prisma.drawingImportPage.findUnique({
    where: { sourceId_sourcePageNumber: { sourceId, sourcePageNumber } },
  });
}

export async function findDrawingImportPageForJob(jobId: string, pageId: string) {
  return prisma.drawingImportPage.findFirst({
    where: { id: pageId, jobId },
    include: { source: true, attempts: { orderBy: { createdAt: 'desc' } } },
  });
}

export async function updateDrawingImportPageLocalAnalysis(input: {
  pageId: string;
  classification: string;
  classificationConfidence: number;
  extraction: DrawingImportPageExtraction;
  warnings?: string[];
}) {
  return commitPageReview(input.pageId, (page) => {
    const saved = storedExtraction(page);
    return {
      classification: saved && page.finalExtractionJson ? saved.classification : input.classification,
      classificationConfidence: input.classificationConfidence,
      localExtractionJson: json(input.extraction),
      warningsJson: page.finalExtractionJson ? page.warningsJson : json(input.warnings ?? input.extraction.warnings),
    };
  });
}

/** Atomically persist a page-only retry; recovery must never widen it to the packet. */
export async function queueDrawingImportPageReprocess(jobId: string, pageId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.drawingImportJob.findUnique({ where: { id: jobId } });
    const page = await tx.drawingImportPage.findFirst({ where: { id: pageId, jobId } });
    if (!job || !page) throw new Error('Drawing page not found.');
    if (!page.canonicalPdfStoragePath || !page.previewStoragePath) {
      throw new Error('This page has no prepared PDF. Upload the drawing again.');
    }
    const config = parseJson<Record<string, unknown>>(job.configJson, {});
    if (['QUEUED', 'PROCESSING', 'CANCEL_REQUESTED'].includes(job.status)) {
      if (config.reprocessPageId === pageId && job.status !== 'CANCEL_REQUESTED') return false;
      throw new Error('Wait for the current drawing request to finish before reprocessing another page.');
    }
    const queued = await tx.drawingImportJob.updateMany({
      where: { id: jobId, status: job.status },
      data: {
        status: 'QUEUED', stage: 'queued', completedAt: null, countsJson: null,
        cancelRequestedAt: null, lastHeartbeatAt: null,
        configJson: json({ ...config, reprocessPageId: pageId }),
      },
    });
    if (queued.count !== 1) throw new Error('This import is already processing. Try again when it finishes.');
    await tx.drawingExtractionAttempt.updateMany({
      where: { pageId, status: 'completed', sourceType: 'model' },
      data: { status: 'superseded' },
    });
    await tx.drawingImportPage.update({
      where: { id: pageId },
      // Keep the last review visible while the fresh result is pending.
      data: { reviewStatus: 'PENDING', duplicateOfPageId: null },
    });
    return true;
  });
}

export async function findCompletedDrawingImportAiAttempt(pageId: string, routeTier: string) {
  return prisma.drawingExtractionAttempt.findFirst({
    where: { pageId, routeTier, status: 'completed' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function countDrawingImportAttempts(pageId: string, routeTier: string) {
  return prisma.drawingExtractionAttempt.count({ where: { pageId, routeTier } });
}

export async function listDrawingImportPageStatuses(jobId: string) {
  return prisma.drawingImportPage.findMany({
    where: { jobId },
    select: { reviewStatus: true, routeTier: true },
  });
}

export async function markDrawingImportPageFailed(pageId: string, message: string) {
  return prisma.drawingImportPage.update({
    where: { id: pageId },
    data: { reviewStatus: 'FAILED', warningsJson: json([message]) },
  });
}

export async function markDrawingImportPageProcessing(pageId: string) {
  return prisma.drawingImportPage.updateMany({
    where: { id: pageId, reviewStatus: 'PENDING' },
    data: { reviewStatus: 'PROCESSING' },
  });
}

export async function queueDrawingImportJob(jobId: string) {
  return prisma.drawingImportJob.update({
    where: { id: jobId },
    data: {
      status: 'QUEUED',
      stage: 'queued',
      completedAt: null,
      errorSummary: null,
      cancelRequestedAt: null,
      lastHeartbeatAt: null,
    },
  });
}

export async function findDuplicateDrawingImportPage(jobId: string, pageId: string, contentSha256: string) {
  const current = await prisma.drawingImportPage.findUnique({ where: { id: pageId }, select: { createdAt: true } });
  if (!current) return null;
  return prisma.drawingImportPage.findFirst({
    where: {
      jobId,
      contentSha256,
      id: { not: pageId },
      OR: [
        { createdAt: { lt: current.createdAt } },
        { createdAt: current.createdAt, id: { lt: pageId } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateDrawingImportPageResult(input: {
  pageId: string;
  extraction: DrawingImportPageExtraction;
  reviewStatus: string;
  routeTier: string;
  classification?: string;
  classificationConfidence?: number;
  warnings?: string[];
  duplicateOfPageId?: string | null;
}) {
  return commitPageReview(input.pageId, (page) => {
    const extraction = preserveHumanDrawingReview(input.extraction, storedExtraction(page));
    return {
      finalExtractionJson: json(extraction),
      reviewStatus: input.reviewStatus === 'FAILED' ? 'FAILED' : drawingReviewStatus(extraction),
      routeTier: input.routeTier,
      classification: extraction.classification,
      ...(input.classificationConfidence !== undefined && !hasHumanDrawingClassification(extraction) ? { classificationConfidence: input.classificationConfidence } : {}),
      warningsJson: json(input.warnings ?? extraction.warnings),
      ...(hasHumanDrawingClassification(extraction) && extraction.classification !== 'duplicate'
        ? { duplicateOfPageId: null }
        : input.duplicateOfPageId !== undefined ? { duplicateOfPageId: input.duplicateOfPageId } : {}),
    };
  });
}

export type CreateDrawingExtractionAttemptInput = {
  pageId: string;
  stage: string;
  sourceType: string;
  routeTier: string;
  idempotencyKey: string;
  parserVersion?: string | null;
  profileVersion?: string | null;
  promptVersion?: string | null;
  requestHash?: string | null;
  usage?: DrawingImportUsage | null;
  result?: unknown;
  warnings?: string[];
  errorSummary?: string | null;
  supersedesAttemptId?: string | null;
};

export async function createDrawingExtractionAttempt(input: CreateDrawingExtractionAttemptInput) {
  const usage = input.usage;
  return prisma.drawingExtractionAttempt.create({
    data: {
      pageId: input.pageId,
      stage: input.stage,
      sourceType: input.sourceType,
      routeTier: input.routeTier,
      parserVersion: input.parserVersion ?? null,
      profileVersion: input.profileVersion ?? null,
      promptVersion: input.promptVersion ?? null,
      requestedModel: usage?.requestedModel ?? null,
      resolvedModel: usage?.resolvedModel ?? null,
      reasoningEffort: usage?.reasoningEffort ?? null,
      serviceTier: usage?.serviceTier ?? null,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash ?? null,
      inputTokens: usage?.inputTokens ?? 0,
      cachedInputTokens: usage?.cachedInputTokens ?? 0,
      cacheWriteTokens: usage?.cacheWriteTokens ?? null,
      outputTokens: usage?.outputTokens ?? 0,
      reasoningTokens: usage?.reasoningTokens ?? 0,
      estimatedCostUsd: usage?.estimatedCostUsd ?? 0,
      calculatedCostUsd: usage?.calculatedCostUsd ?? 0,
      latencyMs: usage?.latencyMs ?? 0,
      retryCount: usage?.retryCount ?? 0,
      status: usage?.status ?? (input.errorSummary ? 'failed' : 'completed'),
      responseId: usage?.responseId ?? null,
      resultJson: input.result === undefined ? null : json(input.result),
      warningsJson: json(input.warnings ?? []),
      errorSummary: input.errorSummary ?? null,
      supersedesAttemptId: input.supersedesAttemptId ?? null,
    },
  });
}

export async function createDrawingImportBomRows(jobId: string, rows: Array<{
  sourcePageId: string;
  rowIndex: number;
  item: string | null;
  childPartNumber: string | null;
  description: string | null;
  quantityPerParent: number | null;
  material: string | null;
  revision: string | null;
  parentAssemblyPartNumber: string | null;
  sourceRegion: unknown;
  rawCells: unknown;
  warnings: string[];
}>) {
  if (!rows.length) return;
  // SQLite does not support createMany.skipDuplicates. Recovery must leave
  // existing rows and their linked edges intact while adding any missing rows.
  await prisma.$transaction(rows.map((row) => prisma.drawingImportBomRow.upsert({
    where: { sourcePageId_rowIndex: { sourcePageId: row.sourcePageId, rowIndex: row.rowIndex } },
    create: {
      id: `${row.sourcePageId}:bom-row:${row.rowIndex}`,
      jobId,
      sourcePageId: row.sourcePageId,
      rowIndex: row.rowIndex,
      item: row.item,
      childPartNumber: row.childPartNumber,
      description: row.description,
      quantityPerParent: row.quantityPerParent,
      material: row.material,
      revision: row.revision,
      parentAssemblyPartNumber: row.parentAssemblyPartNumber,
      sourceRegionJson: json(row.sourceRegion),
      rawCellsJson: json(row.rawCells),
      warningsJson: json(row.warnings),
    },
    update: {},
  })));
}

export async function listDrawingImportBomRows(jobId: string) {
  return prisma.drawingImportBomRow.findMany({ where: { jobId }, orderBy: [{ sourcePageId: 'asc' }, { rowIndex: 'asc' }] });
}

export async function replaceDrawingImportBomEdges(edges: Array<{
  bomRowId: string;
  parentPageId: string | null;
  childPageId: string | null;
  quantityPerParent: number | null;
  status: string;
  warnings: string[];
}>) {
  if (!edges.length) return;
  await prisma.$transaction(edges.map((edge) => prisma.drawingImportBomEdge.upsert({
    where: { bomRowId: edge.bomRowId },
    create: {
      bomRowId: edge.bomRowId,
      parentPageId: edge.parentPageId,
      childPageId: edge.childPageId,
      quantityPerParent: edge.quantityPerParent,
      status: edge.status,
      warningsJson: json(edge.warnings),
    },
    update: {
      parentPageId: edge.parentPageId,
      childPageId: edge.childPageId,
      quantityPerParent: edge.quantityPerParent,
      status: edge.status,
      warningsJson: json(edge.warnings),
    },
  })));
}

export async function recordHumanDrawingImportCorrection(input: {
  pageId: string;
  extraction: DrawingImportPageExtraction;
  field: DrawingImportFieldName | 'classification';
  idempotencyKey: string;
}) {
  return commitPageReview(input.pageId, (page) => {
    const saved = storedExtraction(page);
    const fileOnlyFallback = !saved && input.field === 'classification' && input.extraction.classification === 'reference'
      && input.extraction.classificationEvidence.some((evidence) => evidence.sourceType === 'human' && evidence.sourcePageId === input.pageId);
    if (!saved && !fileOnlyFallback) throw new Error('This page does not have a reviewable extraction yet.');
    // Never use a stale caller's fact values as the initial extraction.
    const extraction = saved ? normalizeDrawingImportPageExtraction(saved) : createFileOnlyDrawingExtraction(input.pageId);
    if (input.field === 'classification') {
      extraction.classification = input.extraction.classification;
      extraction.classificationEvidence = input.extraction.classificationEvidence;
      extraction.route = 'human';
    } else extraction[input.field] = input.extraction[input.field] as never;
    return {
      finalExtractionJson: json(extraction), classification: extraction.classification,
      ...(input.field === 'classification' && extraction.classification !== 'duplicate' ? { duplicateOfPageId: null } : {}),
      // A confirmation never declares the still-running model request complete.
      reviewStatus: ['PENDING', 'PROCESSING'].includes(page.reviewStatus) ? page.reviewStatus : drawingReviewStatus(extraction),
      routeTier: page.routeTier, warningsJson: json(extraction.warnings),
    };
  }, input.idempotencyKey);
}

export async function listActiveDrawingImportJobs() {
  return prisma.drawingImportJob.findMany({
    where: { status: { in: ['QUEUED', 'PROCESSING', 'CANCEL_REQUESTED'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, lastHeartbeatAt: true },
  });
}

export function toDrawingImportJobProgress(job: NonNullable<Awaited<ReturnType<typeof findDrawingImportJobById>>>): DrawingImportJobProgress {
  const counts = parseJson<Record<string, number>>(job.countsJson, {});
  const startedAt = job.startedAt?.getTime() ?? job.createdAt.getTime();
  return {
    jobId: job.id,
    status: job.status as DrawingImportJobStatus,
    stage: job.stage as DrawingImportJobStage,
    totalPages: counts.totalPages ?? job.pages.length,
    // Page rows are authoritative; cached totals can predate a human save or a model result.
    completedPages: job.pages.filter((page) => !['PENDING', 'PROCESSING'].includes(page.reviewStatus)).length,
    locallyAcceptedPages: job.pages.filter((page) => page.routeTier === 'local' && page.reviewStatus === 'ACCEPTED').length,
    terraProcessedPages: job.pages.filter((page) => page.routeTier.startsWith('terra_')).length,
    solEscalatedPages: job.pages.filter((page) => page.routeTier === 'sol_escalation').length,
    manualReviewPages: job.pages.filter((page) => page.reviewStatus === 'MANUAL_REVIEW').length,
    failedPages: job.pages.filter((page) => page.reviewStatus === 'FAILED').length,
    estimatedCostUsd: job.estimatedCostUsd,
    actualCostUsd: job.actualCostUsd,
    elapsedMs: Math.max(0, (job.completedAt?.getTime() ?? Date.now()) - startedAt),
    firstPageReadyAt: job.firstPageReadyAt?.toISOString() ?? null,
    errorSummary: job.errorSummary,
  };
}
