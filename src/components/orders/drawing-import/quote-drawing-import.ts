import { bestMaterialMatch, deriveDrawingStockDimensions } from '@/modules/drawing-import/drawing-import.materials';
import type { DrawingImportFieldName } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import type {
  DrawingImportReviewFile,
  DrawingImportReviewPage,
  ReviewedQuoteDrawingPartV2,
} from './drawing-import-ui.types';

type MaterialOption = { id: string; name: string };

const PART_CLASSIFICATIONS = new Set(['part_drawing', 'assembly_drawing']);
const REQUIRED_FIELDS: DrawingImportFieldName[] = ['partNumber', 'partName', 'drawingQuantity', 'material'];
const DETAIL_DIMENSION_FIELDS: DrawingImportFieldName[] = ['finalLength', 'partWidth', 'partThickness'];

export type QuoteDrawingImportResult = {
  parts: ReviewedQuoteDrawingPartV2[];
  files: DrawingImportReviewFile[];
  blockingMessages: string[];
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

  for (const page of pages) {
    const pageLabel = `${page.filename}, page ${page.sourcePageNumber}`;
    if (page.classification === 'uncertain') {
      blockingMessages.push(`${pageLabel} still needs a page-type decision.`);
      continue;
    }
    if (!PART_CLASSIFICATIONS.has(page.classification)) {
      if (page.originalPacketSource) supportingFiles.push(page.originalPacketSource);
      else if (page.canonicalSource) supportingFiles.push(page.canonicalSource);
      continue;
    }
    if (page.processingStatus === 'failed' || !page.extraction) {
      blockingMessages.push(`${pageLabel} has not produced a reviewable result.`);
      continue;
    }
    const extraction = page.extraction;
    const requiredFields = page.classification === 'part_drawing'
      ? [...REQUIRED_FIELDS, ...DETAIL_DIMENSION_FIELDS]
      : REQUIRED_FIELDS;
    for (const field of requiredFields) {
      const extracted = extraction[field];
      if (extracted.value === null || ['not_present', 'unreadable', 'conflicting', 'tentative_filename_fallback'].includes(extracted.status)) {
        blockingMessages.push(`${pageLabel}: ${field} requires confirmation.`);
      }
    }
    if (!page.canonicalSource) {
      blockingMessages.push(`${pageLabel} is missing its authoritative page file.`);
      continue;
    }
    const quantity = extraction.drawingQuantity.value;
    if (!Number.isInteger(quantity) || Number(quantity) < 1) {
      blockingMessages.push(`${pageLabel}: quantity must be a positive whole number.`);
    }
    const materialText = extraction.material.value ?? '';
    const materialId = bestMaterialMatch(materialText, materials);
    if (!materialId) blockingMessages.push(`${pageLabel}: material “${materialText || 'not present'}” is not matched to the catalog.`);
    const partWidth = extraction.partWidth.value ?? '';
    const partThickness = extraction.partThickness.value ?? '';
    const finalPartLength = extraction.finalLength.value ?? '';
    const derivedStock = deriveDrawingStockDimensions(partThickness, partWidth, finalPartLength, Number(quantity));
    parts.push({
      key: page.pageId,
      importPageId: page.pageId,
      partNumber: extraction.partNumber.value ?? '',
      partName: extraction.partName.value ?? '',
      quantity: Number.isInteger(quantity) && Number(quantity) > 0 ? Number(quantity) : 1,
      materialId,
      finish: extraction.finish.value ?? '',
      stockSize: derivedStock.totalStockDimensions || extraction.stockSize.value || '',
      cutLength: derivedStock.cutLength || extraction.cutLength.value || '',
      finalPartLength,
      partWidth,
      partThickness,
      revision: extraction.revision.value ?? '',
      drawingMaterialText: materialText,
      drawingFinishText: extraction.finish.value ?? '',
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

  if (!parts.length) blockingMessages.push('No reviewed part drawings are ready to add to this quote.');
  return { parts, files: dedupeFiles(supportingFiles), blockingMessages: [...new Set(blockingMessages)] };
}
