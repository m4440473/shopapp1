import 'server-only';

import { createHash } from 'node:crypto';

import { isDrawingPartAttachment } from '@/lib/attachment-visibility';
import type { ManufacturingDrawingNote } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import type { CustomerPartHistoryQueryInput } from './customer-parts.schema';
import {
  findHistoricalCustomerPart,
  listHistoricalCustomerParts,
  type HistoricalCustomerPartRecord,
} from './customer-parts.repo';
import type {
  CustomerPartHistoryDetail,
  CustomerPartHistorySummary,
  CustomerPartHistoryVersion,
  CustomerPartNoteSuggestion,
} from './customer-parts.types';

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export function normalizeCustomerPartNumber(value: string) {
  return value.normalize('NFKC').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function normalizedSearch(value: string | null | undefined) {
  return value?.normalize('NFKC').trim().toLocaleLowerCase() ?? '';
}

function versionFromRecord(record: HistoricalCustomerPartRecord): CustomerPartHistoryVersion {
  return {
    sourcePartId: record.id,
    sourceOrderId: record.order.id,
    sourceOrderNumber: record.order.orderNumber,
    sourceOrderStatus: record.order.status,
    sourceCustomerName: record.order.customer.name,
    business: record.order.business,
    partNumber: record.partNumber,
    partName: record.partName ?? null,
    materialName: record.material?.name ?? null,
    receivedAt: record.order.receivedDate.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    hasDrawing: record.attachments.some(isDrawingPartAttachment),
  };
}

function staticFingerprint(record: HistoricalCustomerPartRecord) {
  return JSON.stringify({
    partName: normalizedSearch(record.partName),
    materialId: record.materialId ?? null,
    drawingMaterialText: normalizedSearch(record.drawingMaterialText),
    drawingFinishText: normalizedSearch(record.drawingFinishText),
    finish: normalizedSearch(record.finish),
    stockSize: normalizedSearch(record.stockSize),
    cutLength: normalizedSearch(record.cutLength),
    finalPartLength: normalizedSearch(record.finalPartLength),
    partWidth: normalizedSearch(record.partWidth),
    partThickness: normalizedSearch(record.partThickness),
    drawings: record.attachments.filter(isDrawingPartAttachment).map((item) => item.storagePath ?? item.url ?? item.label ?? ''),
  });
}

export function groupHistoricalCustomerParts(
  records: HistoricalCustomerPartRecord[],
  query: Pick<CustomerPartHistoryQueryInput, 'q' | 'take'>,
) {
  const needle = normalizedSearch(query.q);
  const matching = needle
    ? records.filter((record) => [record.partNumber, record.partName, record.material?.name, record.order.orderNumber, record.order.customer.name, record.order.business]
      .some((value) => normalizedSearch(value).includes(needle)))
    : records;
  const grouped = new Map<string, HistoricalCustomerPartRecord[]>();
  for (const record of matching) {
    const normalizedPartNumber = normalizeCustomerPartNumber(record.partNumber);
    const groupKey = normalizedPartNumber || `source:${record.id}`;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), record]);
  }

  return [...grouped.entries()].slice(0, query.take).map(([groupKey, versions]): CustomerPartHistorySummary => {
    const latestRecord = versions[0];
    const fingerprints = new Set(versions.map(staticFingerprint));
    return {
      groupKey,
      normalizedPartNumber: normalizeCustomerPartNumber(latestRecord.partNumber),
      partNumber: latestRecord.partNumber,
      partName: latestRecord.partName ?? null,
      materialName: latestRecord.material?.name ?? null,
      versionCount: versions.length,
      hasConflictingVersions: fingerprints.size > 1,
      latest: versionFromRecord(latestRecord),
      versions: versions.map(versionFromRecord),
    };
  });
}

function parseManufacturingNotes(record: HistoricalCustomerPartRecord): ManufacturingDrawingNote[] {
  const page = record.drawingImportPage;
  if (!page) return [];
  try {
    const parsed = JSON.parse(page.finalExtractionJson ?? page.localExtractionJson ?? '{}') as {
      manufacturingNotes?: unknown;
    };
    if (!Array.isArray(parsed.manufacturingNotes)) return [];
    return parsed.manufacturingNotes.filter((entry): entry is ManufacturingDrawingNote => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<ManufacturingDrawingNote>;
      return typeof candidate.text === 'string' && candidate.text.trim().length > 0 && Array.isArray(candidate.evidence);
    });
  } catch {
    return [];
  }
}

function suggestionId(parts: string[]) {
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 20);
}

function buildNoteSuggestions(record: HistoricalCustomerPartRecord): CustomerPartNoteSuggestion[] {
  const orderLabel = `Order ${record.order.orderNumber}`;
  const reviewed: CustomerPartNoteSuggestion[] = [];
  if (record.notes?.trim()) {
    reviewed.push({
      id: suggestionId([record.id, 'notes', record.notes.trim()]),
      destination: 'notes',
      text: record.notes.trim(),
      source: 'reviewed_part_note',
      sourceLabel: `${orderLabel} part notes`,
      evidenceHref: `/orders/${encodeURIComponent(record.order.id)}?part=${encodeURIComponent(record.id)}`,
      evidenceQuality: 'human_reviewed',
      requiresDrawingReview: false,
    });
  }
  if (record.workInstructions?.trim()) {
    reviewed.push({
      id: suggestionId([record.id, 'workInstructions', record.workInstructions.trim()]),
      destination: 'workInstructions',
      text: record.workInstructions.trim(),
      source: 'reviewed_work_instruction',
      sourceLabel: `${orderLabel} required reading`,
      evidenceHref: `/orders/${encodeURIComponent(record.order.id)}?part=${encodeURIComponent(record.id)}`,
      evidenceQuality: 'human_reviewed',
      requiresDrawingReview: false,
    });
  }

  const page = record.drawingImportPage;
  const pageHref = page?.canonicalPdfStoragePath
    ? `/api/admin/quotes/drawing-import-v2/${encodeURIComponent(page.jobId)}/pages/${encodeURIComponent(page.id)}/artifact?kind=canonical`
    : null;
  const extracted = parseManufacturingNotes(record).map((note): CustomerPartNoteSuggestion => {
    const mapped = note.evidence.some((evidence) => Boolean(evidence.sourceRegion));
    return {
      id: suggestionId([record.id, 'drawing', note.text.trim()]),
      destination: note.category === 'inspection' ? 'notes' : 'workInstructions',
      text: note.text.trim(),
      source: 'drawing_extraction',
      sourceLabel: `${page?.sourceFilename ?? 'Drawing'}, page ${page?.sourcePageNumber ?? 1}`,
      evidenceHref: pageHref,
      evidenceQuality: mapped ? 'mapped_region' : 'page_only',
      requiresDrawingReview: true,
    };
  });
  const deduped = new Map<string, CustomerPartNoteSuggestion>();
  for (const item of [...reviewed, ...extracted]) {
    const key = `${item.destination}:${normalizedSearch(item.text)}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return [...deduped.values()];
}

export async function listCustomerPartHistory(_customerId: string, query: CustomerPartHistoryQueryInput) {
  const records = await listHistoricalCustomerParts({
    candidateLimit: Math.min(500, Math.max(query.take * 8, 100)),
  });
  return ok({ items: groupHistoricalCustomerParts(records, query) });
}

export async function getCustomerPartHistoryDetail(_customerId: string, sourcePartId: string) {
  const record = await findHistoricalCustomerPart({ sourcePartId });
  if (!record) return fail<CustomerPartHistoryDetail>(404, 'Historical customer part not found.');
  const attachments = record.attachments.filter(isDrawingPartAttachment).map((attachment) => ({
    kind: attachment.kind.toUpperCase() as CustomerPartHistoryDetail['attachments'][number]['kind'],
    url: attachment.url ?? null,
    storagePath: attachment.storagePath ?? null,
    label: attachment.label ?? null,
    mimeType: attachment.mimeType ?? null,
  }));
  return ok<CustomerPartHistoryDetail>({
    customerId: record.order.customerId,
    sourcePartId: record.id,
    sourceOrderId: record.order.id,
    sourceOrderNumber: record.order.orderNumber,
    sourceOrderStatus: record.order.status,
    business: record.order.business,
    receivedAt: record.order.receivedDate.toISOString(),
    partNumber: record.partNumber,
    partName: record.partName ?? null,
    materialId: record.materialId ?? null,
    drawingMaterialText: record.drawingMaterialText ?? null,
    drawingFinishText: record.drawingFinishText ?? null,
    finish: record.finish ?? null,
    stockSize: record.stockSize ?? null,
    cutLength: record.cutLength ?? null,
    finalPartLength: record.finalPartLength ?? null,
    partWidth: record.partWidth ?? null,
    partThickness: record.partThickness ?? null,
    drawingImportPageId: record.drawingImportPage?.id ?? null,
    attachments,
    noteSuggestions: buildNoteSuggestions(record),
  });
}
