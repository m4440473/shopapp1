import { bestMaterialMatch, deriveDrawingStockDimensions } from '@/modules/drawing-import/drawing-import.materials';
import type { DrawingImportFieldName } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import type {
  DrawingImportReviewFile,
  DrawingImportReviewPage,
  ReviewedQuoteDrawingPartV2,
} from './drawing-import-ui.types';

type MaterialOption = { id: string; name: string };

const PART_CLASSIFICATIONS = new Set(['part_drawing', 'assembly_drawing']);
const REQUIRED_FIELDS: DrawingImportFieldName[] = ['partNumber', 'partName', 'drawingQuantity'];
const DETAIL_DIMENSION_FIELDS: DrawingImportFieldName[] = ['finalLength', 'partWidth', 'partThickness'];
const FIELD_LABELS: Partial<Record<DrawingImportFieldName, string>> = {
  partNumber: 'Part number', partName: 'Part name', drawingQuantity: 'Quantity', material: 'Material',
  finalLength: 'Final length', partWidth: 'Width / outside diameter', partThickness: 'Thickness / wall thickness',
};

export type QuoteDrawingImportResult = {
  parts: ReviewedQuoteDrawingPartV2[];
  files: DrawingImportReviewFile[];
  blockingMessages: string[];
  blockingIssues: Array<{ pageId: string; pageLabel?: string; field?: DrawingImportFieldName; message: string }>;
};

function dedupeFiles(files: DrawingImportReviewFile[]) {
  return [...new Map(files.map((file) => [file.storagePath, file])).values()];
}

export function buildReviewedQuoteDrawingImport(
  pages: DrawingImportReviewPage[],
  materials: MaterialOption[],
  jobSupportingFiles: DrawingImportReviewFile[] = [],
): QuoteDrawingImportResult {
  const parts: ReviewedQuoteDrawingPartV2[] = [];
  const supportingFiles: DrawingImportReviewFile[] = [...jobSupportingFiles];
  const blockingMessages: string[] = [];
  const blockingIssues: QuoteDrawingImportResult['blockingIssues'] = [];
  function block(page: DrawingImportReviewPage, message: string, field?: DrawingImportFieldName) {
    blockingMessages.push(`${page.filename}, page ${page.sourcePageNumber}: ${message}`);
    blockingIssues.push({ pageId: page.pageId, pageLabel: `${page.filename}, page ${page.sourcePageNumber}`, field, message });
  }

  for (const page of pages) {
    const pageLabel = `${page.filename}, page ${page.sourcePageNumber}`;
    if (page.classification === 'uncertain') {
      block(page, 'Choose Treat as part drawing or Keep file only.');
      continue;
    }
    if (!PART_CLASSIFICATIONS.has(page.classification)) {
      // A file-only decision retains both the exact reviewed page and its source packet.
      if (page.originalPacketSource) supportingFiles.push(page.originalPacketSource);
      if (page.canonicalSource) supportingFiles.push(page.canonicalSource);
      if (!page.originalPacketSource && !page.canonicalSource) block(page, 'The saved source file is unavailable.');
      continue;
    }
    if (page.processingStatus === 'failed' || !page.extraction) {
      block(page, 'AI did not return a reviewable result. Keep file only to enter the part manually, or retry this page.');
      continue;
    }
    const extraction = page.extraction;
    let identityBlocked = false;
    for (const field of REQUIRED_FIELDS) {
      const extracted = extraction[field];
      if (extracted.value === null || String(extracted.value).trim() === '' || ['not_present', 'unreadable', 'conflicting', 'tentative_filename_fallback'].includes(extracted.status)) {
        block(page, `${FIELD_LABELS[field]} requires confirmation.`, field);
        identityBlocked = true;
      }
    }
    if (!page.canonicalSource) {
      block(page, 'The authoritative page file is missing.');
      continue;
    }
    const quantity = extraction.drawingQuantity.value;
    if (!Number.isInteger(quantity) || Number(quantity) < 1) {
      block(page, 'Quantity must be a positive whole number.', 'drawingQuantity');
      identityBlocked = true;
    }
    if (identityBlocked) continue;
    const unresolvedFields: DrawingImportFieldName[] = [];
    const reviewWarnings: string[] = [];
    const draftReviewFields = page.classification === 'part_drawing' ? ['material' as const, ...DETAIL_DIMENSION_FIELDS] : ['material' as const];
    for (const field of draftReviewFields) {
      const extracted = extraction[field];
      if (extracted.value === null || String(extracted.value).trim() === '' || ['not_present', 'unreadable', 'conflicting', 'tentative_filename_fallback'].includes(extracted.status)) {
        unresolvedFields.push(field);
        reviewWarnings.push(`${FIELD_LABELS[field]} is unresolved; review the drawing before production.`);
      }
    }
    const materialText = extraction.material.value ?? '';
    const materialId = unresolvedFields.includes('material') ? '' : bestMaterialMatch(materialText, materials);
    if (!materialId && !unresolvedFields.includes('material')) {
      unresolvedFields.push('material');
      reviewWarnings.push(`Material “${materialText}” is not matched to the catalog.`);
    }
    const partWidth = extraction.partWidth.value ?? '';
    const partThickness = extraction.partThickness.value ?? '';
    const finalPartLength = extraction.finalLength.value ?? '';
    const derivedStock = DETAIL_DIMENSION_FIELDS.some((field) => unresolvedFields.includes(field))
      ? { totalStockDimensions: '', cutLength: '' }
      : deriveDrawingStockDimensions(partThickness, partWidth, finalPartLength, Number(quantity));
    parts.push({
      key: page.pageId,
      importPageId: page.pageId,
      partNumber: extraction.partNumber.value ?? '',
      partName: extraction.partName.value ?? '',
      quantity: Number(quantity),
      materialId,
      finish: extraction.finish.value ?? '',
      stockSize: derivedStock.totalStockDimensions || (['read', 'human_corrected'].includes(extraction.stockSize.status) ? extraction.stockSize.value : '') || '',
      cutLength: derivedStock.cutLength || (['read', 'human_corrected'].includes(extraction.cutLength.status) ? extraction.cutLength.value : '') || '',
      finalPartLength,
      partWidth,
      partThickness,
      revision: extraction.revision.value ?? '',
      drawingMaterialText: materialText,
      drawingFinishText: extraction.finish.value ?? '',
      unresolvedFields,
      reviewWarnings,
      noteSuggestions: (extraction.manufacturingNotes ?? []).map((note, index) => ({
        id: `${page.pageId}-drawing-note-${index}`,
        destination: note.category === 'inspection' ? 'notes' : 'workInstructions',
        text: note.text,
        source: 'drawing_extraction',
        sourceLabel: pageLabel,
        evidenceHref: page.exactPageHref,
        evidenceQuality: note.evidence.some((item) => Boolean(item.sourceRegion)) ? 'mapped_region' : 'page_only',
        requiresDrawingReview: true,
      })),
      source: page.canonicalSource,
    });
    if (page.originalPacketSource) supportingFiles.push(page.originalPacketSource);
  }

  if (!parts.length && !supportingFiles.length && !blockingMessages.length) blockingMessages.push('No saved drawings or files are ready to add to this draft.');
  return { parts, files: dedupeFiles(supportingFiles), blockingMessages: [...new Set(blockingMessages)], blockingIssues };
}
