import 'server-only';

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

import JSZip from 'jszip';
import OpenAI, { toFile } from 'openai';
import { DrawingImportResponseError, getCurrentDrawingImportAiOptions, requireDrawingImportOutput } from './drawing-import-ai-request';

import { getAppSettings } from '@/lib/app-settings';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';
import type { BusinessName } from '@/lib/businesses';
import {
  DRAWING_IMPORT_SUPPORTED_EXTENSIONS,
  DrawingTitleBlockResult,
  type DrawingImportProposal,
  type DrawingImportSupportingFile,
} from './drawing-import.schema';

const MAX_ARCHIVE_ENTRIES = 100;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const EXTRACTION_CONCURRENCY = 4;
export const PDF_TEXT_PAGE_LIMIT = 20;
export const PDF_TEXT_CHARACTER_LIMIT = 80_000;
export const PDF_PACKET_PAGE_LIMIT = 100;
const PDF_PACKET_RENDER_SCALE = 1.5;

type ImportFile = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  sourceDocumentName?: string;
  sourcePageNumber?: number;
  sourceDocumentPageCount?: number;
  pageText?: string;
};

type CanvasModule = {
  createCanvas: (width: number, height: number) => {
    width: number;
    height: number;
    getContext: (contextId: '2d') => unknown;
    encode: (format: 'png') => Promise<Uint8Array>;
  };
};

type CanvasInstance = ReturnType<CanvasModule['createCanvas']>;

async function loadCanvasModule(): Promise<CanvasModule> {
  const moduleName = ['@napi-rs', 'canvas'].join('/');
  return (await import(/* webpackIgnore: true */ moduleName)) as CanvasModule;
}

function extensionFor(filename: string) {
  return path.extname(filename).toLowerCase();
}

function mimeTypeFor(filename: string) {
  const extension = extensionFor(filename);
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  return 'image/jpeg';
}

export function isSupportedDrawingFilename(filename: string) {
  return (DRAWING_IMPORT_SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionFor(filename));
}

export async function resolveDraftDrawingPreview(storagePath: string, rootDir?: string) {
  const normalized = storagePath.trim().replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..') ||
    !isSupportedDrawingFilename(normalized)
  ) {
    throw new Error('Drawing not found.');
  }

  const root = await ensureAttachmentRoot(rootDir);
  const absolutePath = path.resolve(root, ...segments);
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error('Drawing not found.');
  }

  const fileInfo = await stat(absolutePath).catch(() => null);
  if (!fileInfo?.isFile()) throw new Error('Drawing not found.');

  return {
    absolutePath,
    filename: path.basename(absolutePath),
    mimeType: mimeTypeFor(absolutePath),
    size: fileInfo.size,
  };
}

function safeArchiveFilename(filename: string) {
  const normalized = filename.replace(/\\/g, '/');
  const pieces = normalized.split('/').filter(Boolean);
  const leaf = pieces.at(-1) ?? '';
  if (!leaf || leaf === '.' || leaf === '..' || normalized.includes('../')) return null;
  return leaf;
}

export async function expandDrawingUpload(file: File): Promise<ImportFile[]> {
  const uploadBuffer = Buffer.from(await file.arrayBuffer());
  if (uploadBuffer.length > MAX_TOTAL_BYTES) {
    throw new Error('That upload is too large. Use a ZIP smaller than 100 MB.');
  }

  if (extensionFor(file.name) !== '.zip') {
    if (!isSupportedDrawingFilename(file.name)) {
      throw new Error('Use a PDF, PNG, JPG, or ZIP containing those drawing types.');
    }
    if (uploadBuffer.length > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is larger than the 20 MB per-drawing limit.`);
    }
    return [{ filename: path.basename(file.name), mimeType: file.type || mimeTypeFor(file.name), buffer: uploadBuffer }];
  }

  const archive = await JSZip.loadAsync(uploadBuffer, { checkCRC32: true, createFolders: false });
  const entries = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'));
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`This ZIP contains ${entries.length} files. The limit is ${MAX_ARCHIVE_ENTRIES}.`);
  }

  const drawings: ImportFile[] = [];
  let expandedBytes = 0;
  for (const entry of entries) {
    const originalName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    const filename = safeArchiveFilename(originalName);
    if (!filename || !isSupportedDrawingFilename(filename)) continue;
    const zipSizes = (entry as typeof entry & { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
    const declaredSize = Number(zipSizes?.uncompressedSize ?? 0);
    const compressedSize = Number(zipSizes?.compressedSize ?? 0);
    if (declaredSize > MAX_FILE_BYTES) {
      throw new Error(`${filename} is larger than the 20 MB per-drawing limit.`);
    }
    if (declaredSize > 0 && compressedSize > 0 && declaredSize / compressedSize > MAX_COMPRESSION_RATIO) {
      throw new Error(`${filename} has an unsafe compression ratio.`);
    }
    if (expandedBytes + declaredSize > MAX_TOTAL_BYTES) {
      throw new Error('The expanded drawings exceed the 100 MB ZIP limit.');
    }
    const buffer = await entry.async('nodebuffer');
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error(`${filename} is larger than the 20 MB per-drawing limit.`);
    }
    expandedBytes += buffer.length;
    if (expandedBytes > MAX_TOTAL_BYTES) {
      throw new Error('The expanded drawings exceed the 100 MB ZIP limit.');
    }
    drawings.push({ filename, mimeType: mimeTypeFor(filename), buffer });
  }

  if (!drawings.length) {
    throw new Error('No supported PDF, PNG, or JPG drawings were found in this ZIP.');
  }
  return drawings;
}

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  cleanup?: () => Promise<void>;
  destroy: () => Promise<void>;
};

type PdfJsPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: unknown;
    viewport: { width: number; height: number };
    canvasFactory: PdfCanvasFactory;
  }) => { promise: Promise<void> };
  cleanup?: () => void;
};

class PdfCanvasFactory {
  async create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error('Invalid PDF page size.');
    const { createCanvas } = await loadCanvasModule();
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(target: { canvas: CanvasInstance }, width: number, height: number) {
    target.canvas.width = Math.ceil(width);
    target.canvas.height = Math.ceil(height);
  }

  destroy(target: { canvas: CanvasInstance | null; context: unknown | null }) {
    if (!target.canvas) return;
    target.canvas.width = 0;
    target.canvas.height = 0;
    target.canvas = null;
    target.context = null;
  }
}

async function loadPdfDocument(buffer: Buffer) {
  const moduleName = ['pdfjs-dist', 'legacy', 'build', 'pdf.mjs'].join('/');
  const pdfjs = await import(/* webpackIgnore: true */ moduleName);
  return (await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise) as PdfJsDocument;
}

export function getPacketPageFilename(filename: string, pageNumber: number, pageCount: number) {
  const base = path.basename(filename, path.extname(filename));
  const digits = Math.max(3, String(pageCount).length);
  return `${base}-page-${String(pageNumber).padStart(digits, '0')}.png`;
}

export function shouldCreatePartFromDocumentRole(role: DrawingTitleBlockResult['documentRole']) {
  return role !== 'BOM' && role !== 'COVER';
}

export async function splitMultiPagePdfDrawing(file: ImportFile): Promise<ImportFile[] | null> {
  if (file.mimeType !== 'application/pdf') return null;
  const document = await loadPdfDocument(file.buffer);
  try {
    if (document.numPages <= 1) return null;
    if (document.numPages > PDF_PACKET_PAGE_LIMIT) {
      throw new Error(`${file.filename} contains ${document.numPages} pages. Drawing packets are limited to ${PDF_PACKET_PAGE_LIMIT} pages.`);
    }

    const pages: ImportFile[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str ?? '').join(' ').slice(0, 12_000);
      const viewport = page.getViewport({ scale: PDF_PACKET_RENDER_SCALE });
      const canvasFactory = new PdfCanvasFactory();
      const target = await canvasFactory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: target.context, viewport, canvasFactory }).promise;
        pages.push({
          filename: getPacketPageFilename(file.filename, pageNumber, document.numPages),
          mimeType: 'image/png',
          buffer: Buffer.from(await target.canvas.encode('png')),
          sourceDocumentName: file.filename,
          sourcePageNumber: pageNumber,
          sourceDocumentPageCount: document.numPages,
          pageText,
        });
      } finally {
        page.cleanup?.();
        canvasFactory.destroy(target);
      }
    }
    return pages;
  } finally {
    await document.cleanup?.();
    await document.destroy();
  }
}

export function getPdfTextPageScanCount(pageCount: number) {
  return Math.max(0, Math.min(Math.floor(pageCount), PDF_TEXT_PAGE_LIMIT));
}

async function extractPdfText(buffer: Buffer) {
  const document = await loadPdfDocument(buffer);
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= getPdfTextPageScanCount(document.numPages); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str ?? '').join(' '));
    }
    return { text: pages.join('\n\n').slice(0, PDF_TEXT_CHARACTER_LIMIT), pageCount: document.numPages };
  } finally {
    await document.destroy();
  }
}

const PO_LABEL_PATTERN = /(?:PURCHASE\s+ORDER|P\.?\s*O\.?)\s*(?:NUMBER|NO\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,30})/gi;
const PO_STOP_WORDS = new Set(['DATE', 'NUMBER', 'NO', 'SHIP', 'TERMS', 'VENDOR']);

export function extractPurchaseOrderNumberFromText(text: string): string | null {
  for (const match of text.matchAll(PO_LABEL_PATTERN)) {
    const candidate = match[1]?.trim().replace(/[.,;:]$/, '') ?? '';
    if (candidate && !PO_STOP_WORDS.has(candidate.toUpperCase())) return candidate;
  }
  return null;
}

export async function extractPurchaseOrderNumberFromPdf(buffer: Buffer): Promise<string | null> {
  const { text } = await extractPdfText(buffer);
  return extractPurchaseOrderNumberFromText(text);
}

export async function detectPurchaseOrderFromStoredPdfAttachments(
  attachments: Array<{ id?: string | null; label?: string | null; storagePath?: string | null; mimeType?: string | null }>,
  rootDir: string,
): Promise<{ poNumber: string; attachmentId: string | null } | null> {
  const candidates = attachments
    .filter((attachment) => {
      const label = String(attachment.label ?? attachment.storagePath ?? '').toLowerCase();
      return Boolean(attachment.storagePath) && (attachment.mimeType === 'application/pdf' || label.endsWith('.pdf'));
    })
    .sort((left, right) => {
      const score = (attachment: { label?: string | null }) => /(?:purchase[ _-]*order|\bpo[ _#-])/i.test(String(attachment.label ?? '')) ? 1 : 0;
      return score(right) - score(left);
    })
    .slice(0, 10);

  for (const attachment of candidates) {
    try {
      const preview = await resolveDraftDrawingPreview(String(attachment.storagePath), rootDir);
      const poNumber = await extractPurchaseOrderNumberFromPdf(await readFile(preview.absolutePath));
      if (poNumber) return { poNumber, attachmentId: attachment.id ?? null };
    } catch {
      // One unreadable attachment should not block intake or conversion.
    }
  }
  return null;
}

function extractionPrompt(filename: string, bomContext?: string) {
  return [
    'Read this manufacturing document page for order intake.',
    `Source filename: ${filename}`,
    'Return exactly one JSON object with keys partNumber, partName, quantity, material, finish, stockSize, cutLength, finalPartLength, revision, documentRole, isAssembly, warnings.',
    'documentRole must be PART_DRAWING, BOM, COVER, or OTHER.',
    'Use PART_DRAWING when this page is a detail drawing/title block for one manufacturable part. Use BOM for a standalone bill of materials or parts-list page that is not itself a detail drawing. Use COVER for an index, cover sheet, or transmittal. Use OTHER only when uncertain.',
    'Each text field must be {"value": string|null, "confidence": number 0..1, "evidence": string|null}.',
    'Quantity must be {"value": integer|null, "confidence": number 0..1, "evidence": string|null}.',
    'Use null instead of guessing. A drawing number is normally the part number. Part name is the title-block PART NAME.',
    'For a standalone detail drawing, quantity is often not specified: return null, not 1.',
    'Stock size means raw material dimensions/form, not finished-part envelope dimensions.',
    'Final part length means the finished overall length dimension in inches. Do not use stock allowance or quantity. Return null if it is not explicit.',
    'MATERIAL and FINISH are separate title-block fields. Never append a finish such as ZINC PLATE, NICKEL, PAINT, or ANODIZE to the material value.',
    'Finish is the title-block FINISH, COATING, PLATING, PAINT, ANODIZE, or surface-treatment instruction. Preserve its wording.',
    'Set isAssembly true when the drawing is an assembly or contains a parts list for multiple component items.',
    'If material says SEE BOM or SEE PARTS LIST, search the provided uploaded BOM context for the matching part number and use that material only when the match is explicit; otherwise preserve the SEE BOM wording and warn that component materials require review.',
    'Do not return machining-feature BOM details here.',
    bomContext ? `UPLOADED PDF/BOM CONTEXT:\n${bomContext}` : '',
  ].join('\n');
}

export function shouldIncludeUploadedBomContext(filename: string, drawingText: string) {
  return (
    /(?:SEE\s+(?:THE\s+)?(?:BOM|BILL\s+OF\s+MATERIALS?|PARTS?\s+LIST))/i.test(drawingText) ||
    /(?:\bBOM\b|BILL\s+OF\s+MATERIALS?|PARTS?\s+LIST)/i.test(filename) ||
    /(?:\bBOM\b|BILL\s+OF\s+MATERIALS?|PARTS?\s+LIST)/i.test(drawingText.slice(0, 12_000))
  );
}

function isUploadedBomSource(filename: string, text: string) {
  return (
    /(?:\bBOM\b|BILL[ _-]*OF[ _-]*MATERIALS?|PARTS?[ _-]*LIST)/i.test(filename) ||
    /(?:\bBOM\b|BILL\s+OF\s+MATERIALS?|PARTS?\s+LIST)/i.test(text.slice(0, 24_000))
  );
}

function fallbackResult(filename: string): DrawingTitleBlockResult {
  const partNumber = path.basename(filename, path.extname(filename));
  const missing = { value: null, confidence: 0, evidence: null };
  return {
    partNumber: { value: partNumber, confidence: 0.55, evidence: 'Filename' },
    partName: { ...missing },
    quantity: { ...missing },
    material: { ...missing },
    finish: { ...missing },
    stockSize: { ...missing },
    cutLength: { ...missing },
    finalPartLength: { ...missing },
    revision: { ...missing },
    documentRole: 'OTHER',
    isAssembly: false,
    warnings: ['Automatic title-block reading was unavailable. Please check the highlighted fields.'],
  };
}

export async function extractTitleBlock(
  file: ImportFile,
  preparedPdf?: { text: string; pageCount: number } | null,
  bomContext?: string,
) {
  if (!process.env.OPENAI_API_KEY) return { result: fallbackResult(file.filename), pageCount: null };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let uploadedFileId: string | null = null;
  try {
    let content: any[];
    let pageCount: number | null = null;
    const sourceDescription = file.sourcePageNumber
      ? `${file.sourceDocumentName}, page ${file.sourcePageNumber} of ${file.sourceDocumentPageCount}`
      : file.filename;
    if (file.mimeType === 'application/pdf') {
      const pdf = preparedPdf ?? await extractPdfText(file.buffer);
      pageCount = pdf.pageCount;
      content = [{ type: 'input_text', text: `${extractionPrompt(sourceDescription, bomContext)}\n\nDRAWING TEXT:\n${pdf.text}` }];
    } else {
      const uploaded = await openai.files.create({
        file: await toFile(file.buffer, file.filename, { type: file.mimeType }),
        purpose: 'vision',
      });
      uploadedFileId = uploaded.id;
      content = [
        {
          type: 'input_text',
          text: `${extractionPrompt(sourceDescription, bomContext)}${file.pageText ? `\n\nPAGE TEXT:\n${file.pageText}` : ''}`,
        },
        { type: 'input_image', file_id: uploaded.id, detail: 'high' },
      ];
    }

    const response = await openai.responses.create({
      ...getCurrentDrawingImportAiOptions(),
      input: [{ role: 'user', content }],
    });
    const parsed = JSON.parse(requireDrawingImportOutput(response));
    const validated = DrawingTitleBlockResult.safeParse(parsed);
    if (!validated.success) {
      const fallback = fallbackResult(file.filename);
      fallback.warnings.push('Some extracted fields could not be validated.');
      return { result: fallback, pageCount };
    }
    return { result: validated.data, pageCount };
  } catch (error) {
    const fallback = fallbackResult(file.filename);
    if (error instanceof DrawingImportResponseError) fallback.warnings.push(error.message);
    return { result: fallback, pageCount: null };
  } finally {
    if (uploadedFileId) await openai.files.delete(uploadedFileId).catch(() => undefined);
  }
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency limit must be at least 1.');
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function importDrawingUpload({
  file,
  business,
  customerName,
  draftReference,
  onProgress,
}: {
  file: File;
  business: BusinessName;
  customerName: string;
  draftReference: string;
  onProgress?: (event: string) => void | Promise<void>;
}): Promise<{ proposals: DrawingImportProposal[]; supportingFiles: DrawingImportSupportingFile[] }> {
  const uploadedFiles = await expandDrawingUpload(file);
  await onProgress?.(`archive-complete files=${uploadedFiles.length}`);
  const settings = await getAppSettings();

  const expanded = await mapWithConcurrency(uploadedFiles, EXTRACTION_CONCURRENCY, async (drawing) => {
    const packetPages = await splitMultiPagePdfDrawing(drawing);
    return packetPages ? { drawing, packetPages } : { drawing, packetPages: null };
  });
  const files = expanded.flatMap(({ drawing, packetPages }) => packetPages ?? [drawing]);
  const packetOriginals = expanded.filter((entry) => entry.packetPages).map((entry) => entry.drawing);

  const supportingFiles = await mapWithConcurrency(packetOriginals, EXTRACTION_CONCURRENCY, async (drawing) => {
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: draftReference,
      originalFilename: drawing.filename,
      buffer: drawing.buffer,
      rootDir: settings.attachmentsDir,
    });
    return { storagePath: stored.storagePath, label: drawing.filename, mimeType: drawing.mimeType };
  });

  const pdfData = await mapWithConcurrency(files, EXTRACTION_CONCURRENCY, async (drawing) =>
    drawing.mimeType === 'application/pdf' ? extractPdfText(drawing.buffer).catch(() => null) : null,
  );
  const bomContext = files
    .flatMap((drawing, index) => {
      const text = drawing.pageText ?? pdfData[index]?.text ?? '';
      const sourceName = drawing.sourceDocumentName ?? drawing.filename;
      if (!text || !isUploadedBomSource(sourceName, text)) return [];
      const pageLabel = drawing.sourcePageNumber ? ` PAGE ${drawing.sourcePageNumber}` : '';
      return [`SOURCE ${sourceName}${pageLabel}:\n${text.slice(0, 12_000)}`];
    })
    .join('\n\n')
    .slice(0, 24_000);

  const analyzed = await mapWithConcurrency(files, EXTRACTION_CONCURRENCY, async (drawing, index) => {
    const drawingText = drawing.pageText ?? pdfData[index]?.text ?? '';
    const contextFilename = drawing.sourceDocumentName ?? drawing.filename;
    const routedBomContext = bomContext && shouldIncludeUploadedBomContext(contextFilename, drawingText)
      ? bomContext
      : undefined;
    return { drawing, extracted: await extractTitleBlock(drawing, pdfData[index], routedBomContext) };
  });

  const partCandidates = analyzed.filter(({ extracted }) => shouldCreatePartFromDocumentRole(extracted.result.documentRole));
  const proposals = await mapWithConcurrency(partCandidates, EXTRACTION_CONCURRENCY, async ({ drawing, extracted }) => {
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: draftReference,
      originalFilename: drawing.filename,
      buffer: drawing.buffer,
      rootDir: settings.attachmentsDir,
    });
    const result = extracted.result;
    if (result.documentRole === 'OTHER' && drawing.sourcePageNumber) {
      result.warnings = [
        ...result.warnings,
        'This packet page could not be classified confidently. Confirm that it represents a part before continuing.',
      ];
    }
    return {
      key: randomUUID(),
      filename: drawing.filename,
      mimeType: drawing.mimeType,
      storagePath: stored.storagePath,
      pageCount: drawing.sourcePageNumber ? 1 : extracted.pageCount,
      sourceDocumentName: drawing.sourceDocumentName ?? null,
      sourcePageNumber: drawing.sourcePageNumber ?? null,
      sourceDocumentPageCount: drawing.sourceDocumentPageCount ?? null,
      ...result,
    } satisfies DrawingImportProposal;
  });

  await onProgress?.(`extraction-complete files=${files.length}`);
  return { proposals, supportingFiles };
}
