import 'server-only';

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';

import JSZip from 'jszip';
import OpenAI, { toFile } from 'openai';

import { getAppSettings } from '@/lib/app-settings';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';
import type { BusinessName } from '@/lib/businesses';
import {
  DRAWING_IMPORT_SUPPORTED_EXTENSIONS,
  DrawingTitleBlockResult,
  type DrawingImportProposal,
} from './drawing-import.schema';

const MAX_ARCHIVE_ENTRIES = 50;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const EXTRACTION_MODEL = 'gpt-4.1-mini';

type ImportFile = { filename: string; mimeType: string; buffer: Buffer };

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
  getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }>;
  destroy: () => Promise<void>;
};

async function extractPdfText(buffer: Buffer) {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;
  const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
  const document = (await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise) as PdfJsDocument;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 8); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str ?? '').join(' '));
    }
    return { text: pages.join('\n\n').slice(0, 80_000), pageCount: document.numPages };
  } finally {
    await document.destroy();
  }
}

function extractionPrompt(filename: string) {
  return [
    'Read this manufacturing drawing title block and parts-list context for order intake.',
    `Source filename: ${filename}`,
    'Return exactly one JSON object with keys partNumber, partName, quantity, material, finish, stockSize, cutLength, revision, isAssembly, warnings.',
    'Each text field must be {"value": string|null, "confidence": number 0..1, "evidence": string|null}.',
    'Quantity must be {"value": integer|null, "confidence": number 0..1, "evidence": string|null}.',
    'Use null instead of guessing. A drawing number is normally the part number. Part name is the title-block PART NAME.',
    'For a standalone detail drawing, quantity is often not specified: return null, not 1.',
    'Stock size means raw material dimensions/form, not finished-part envelope dimensions.',
    'MATERIAL and FINISH are separate title-block fields. Never append a finish such as ZINC PLATE, NICKEL, PAINT, or ANODIZE to the material value.',
    'Finish is the title-block FINISH, COATING, PLATING, PAINT, ANODIZE, or surface-treatment instruction. Preserve its wording.',
    'Set isAssembly true when the drawing is an assembly or contains a parts list for multiple component items.',
    'If material says SEE PARTS LIST, preserve that exact wording and warn that component materials require review.',
    'Do not return machining-feature BOM details here.',
  ].join('\n');
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
    revision: { ...missing },
    isAssembly: false,
    warnings: ['Automatic title-block reading was unavailable. Please check the highlighted fields.'],
  };
}

async function extractTitleBlock(file: ImportFile) {
  if (!process.env.OPENAI_API_KEY) return { result: fallbackResult(file.filename), pageCount: null };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let uploadedFileId: string | null = null;
  try {
    let content: any[];
    let pageCount: number | null = null;
    if (file.mimeType === 'application/pdf') {
      const pdf = await extractPdfText(file.buffer);
      pageCount = pdf.pageCount;
      content = [{ type: 'input_text', text: `${extractionPrompt(file.filename)}\n\nDRAWING TEXT:\n${pdf.text}` }];
    } else {
      const uploaded = await openai.files.create({
        file: await toFile(file.buffer, file.filename, { type: file.mimeType }),
        purpose: 'vision',
      });
      uploadedFileId = uploaded.id;
      content = [
        { type: 'input_text', text: extractionPrompt(file.filename) },
        { type: 'input_image', file_id: uploaded.id, detail: 'high' },
      ];
    }

    const response = await openai.responses.create({
      model: EXTRACTION_MODEL,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_object' } },
    });
    const parsed = JSON.parse(response.output_text || '{}');
    const validated = DrawingTitleBlockResult.safeParse(parsed);
    if (!validated.success) {
      const fallback = fallbackResult(file.filename);
      fallback.warnings.push('Some extracted fields could not be validated.');
      return { result: fallback, pageCount };
    }
    return { result: validated.data, pageCount };
  } catch {
    return { result: fallbackResult(file.filename), pageCount: null };
  } finally {
    if (uploadedFileId) await openai.files.delete(uploadedFileId).catch(() => undefined);
  }
}

export async function importDrawingUpload({
  file,
  business,
  customerName,
  draftReference,
}: {
  file: File;
  business: BusinessName;
  customerName: string;
  draftReference: string;
}): Promise<DrawingImportProposal[]> {
  const files = await expandDrawingUpload(file);
  const settings = await getAppSettings();
  const proposals: DrawingImportProposal[] = [];

  for (const drawing of files) {
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: draftReference,
      originalFilename: drawing.filename,
      buffer: drawing.buffer,
      rootDir: settings.attachmentsDir,
    });
    const extracted = await extractTitleBlock(drawing);
    proposals.push({
      key: randomUUID(),
      filename: drawing.filename,
      mimeType: drawing.mimeType,
      storagePath: stored.storagePath,
      pageCount: extracted.pageCount,
      ...extracted.result,
    });
  }

  return proposals;
}
