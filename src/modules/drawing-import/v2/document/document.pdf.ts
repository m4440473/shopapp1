import path from 'node:path';
import { existsSync } from 'node:fs';

import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import type { DrawingImportNormalizedRegion } from '../drawing-import-v2.types';
import { sha256Hex } from './document.hash';
import type {
  CanonicalPdfPage,
  CoordinateAwarePageText,
  CoordinateTextSpan,
  CropArtifact,
  PreviewArtifact,
  ReconstructedTextLine,
} from './document.types';

type PdfJsTextItem = {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
};

type PdfJsTextStyle = {
  ascent?: number;
  descent?: number;
  vertical?: boolean;
  fontFamily?: string;
};

type PdfJsPage = {
  rotate: number;
  userUnit: number;
  view: number[];
  getViewport(params: { scale: number; rotation?: number }): {
    width: number;
    height: number;
    scale: number;
    transform: number[];
  };
  getTextContent(params?: { disableNormalization?: boolean }): Promise<{
    items: Array<PdfJsTextItem | { type: string }>;
    styles: Record<string, PdfJsTextStyle>;
  }>;
  render(params: { canvasContext: unknown; viewport: unknown; canvasFactory: PdfCanvasFactory }): { promise: Promise<void> };
  cleanup?: () => void;
};

type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  cleanup?: () => Promise<void>;
  destroy(): Promise<void>;
};

class PdfCanvasFactory {
  create(width: number, height: number): {
    canvas: Canvas;
    context: unknown;
  } {
    if (width <= 0 || height <= 0) throw new Error('Invalid PDF page size.');
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(target: { canvas: { width: number; height: number } }, width: number, height: number) {
    target.canvas.width = Math.ceil(width);
    target.canvas.height = Math.ceil(height);
  }

  destroy(target: { canvas: { width: number; height: number } | null; context: unknown | null }) {
    if (!target.canvas) return;
    target.canvas.width = 0;
    target.canvas.height = 0;
    target.canvas = null;
    target.context = null;
  }
}

async function loadPdfJsDocument(buffer: Buffer): Promise<PdfJsDocument> {
  const moduleName = ['pdfjs-dist', 'legacy', 'build', 'pdf.mjs'].join('/');
  const pdfjs = await import(/* webpackIgnore: true */ moduleName);
  const standardFontDataUrl = resolvePdfJsStandardFontDataUrl();
  return (await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl,
  }).promise) as PdfJsDocument;
}

export function resolvePdfJsStandardFontDataUrl() {
  // Do not use require.resolve here. Next rewrites a static resolver to a
  // numeric webpack id and rewrites a dynamic resolver to an empty context.
  // The build copies pdfjs-dist into the standalone node_modules directory,
  // so resolve only the verified source/standalone filesystem layouts.
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts'),
    path.join(process.cwd(), '.next', 'standalone', 'node_modules', 'pdfjs-dist', 'standard_fonts'),
    process.argv[1]
      ? path.join(path.dirname(path.resolve(process.argv[1])), 'node_modules', 'pdfjs-dist', 'standard_fonts')
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const standardFontsPath = candidates.find((candidate) => existsSync(candidate));
  if (!standardFontsPath) throw new Error('The PDF.js standard-font directory is missing from this runtime.');
  return `${standardFontsPath.replace(/\\/g, '/')}/`;
}

function normalizeRotation(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function multiplyTransform(left: number[], right: number[]) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function boundingRegion(points: Array<readonly [number, number]>): readonly [number, number, number, number] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function displayRegionForTextItem(
  item: PdfJsTextItem,
  style: PdfJsTextStyle,
  viewport: { width: number; height: number; scale: number; transform: number[] },
) {
  const transformed = multiplyTransform(viewport.transform, item.transform);
  let angle = Math.atan2(transformed[1], transformed[0]);
  if (style.vertical) angle += Math.PI / 2;
  const width = Math.max(0.001, Math.abs(item.width * viewport.scale));
  const height = Math.max(0.001, Math.abs(item.height * viewport.scale), Math.hypot(transformed[2], transformed[3]));
  const direction: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
  const topNormal: readonly [number, number] = [Math.sin(angle), -Math.cos(angle)];
  const origin: readonly [number, number] = [transformed[4], transformed[5]];
  const advance: readonly [number, number] = [origin[0] + direction[0] * width, origin[1] + direction[1] * width];
  const topOrigin: readonly [number, number] = [origin[0] + topNormal[0] * height, origin[1] + topNormal[1] * height];
  const topAdvance: readonly [number, number] = [advance[0] + topNormal[0] * height, advance[1] + topNormal[1] * height];
  const [left, top, right, bottom] = boundingRegion([origin, advance, topOrigin, topAdvance]);
  return {
    region: [
      clamp01(left / viewport.width),
      clamp01(top / viewport.height),
      clamp01(right / viewport.width),
      clamp01(bottom / viewport.height),
    ] as const,
    textRotation: normalizeRotation((angle * 180) / Math.PI),
  };
}

function pdfRegionForTextItem(item: PdfJsTextItem) {
  const angle = Math.atan2(item.transform[1], item.transform[0]);
  const width = Math.max(0.001, Math.abs(item.width));
  const height = Math.max(0.001, Math.abs(item.height), Math.hypot(item.transform[2], item.transform[3]));
  const direction: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
  const topNormal: readonly [number, number] = [-Math.sin(angle), Math.cos(angle)];
  const origin: readonly [number, number] = [item.transform[4], item.transform[5]];
  const advance: readonly [number, number] = [origin[0] + direction[0] * width, origin[1] + direction[1] * width];
  const topOrigin: readonly [number, number] = [origin[0] + topNormal[0] * height, origin[1] + topNormal[1] * height];
  const topAdvance: readonly [number, number] = [advance[0] + topNormal[0] * height, advance[1] + topNormal[1] * height];
  return boundingRegion([origin, advance, topOrigin, topAdvance]);
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

export function normalizeCadText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[¼-¾⅐-⅞]/g, (fraction) => UNICODE_FRACTIONS[fraction] ?? fraction)
    .replace(/⁄/g, '/')
    .replace(/[‐-―−]/g, '-')
    .replace(/⌀/g, 'Ø')
    .replace(/\s+/g, ' ')
    .trim();
}

function unionNormalizedRegions(regions: DrawingImportNormalizedRegion[]): DrawingImportNormalizedRegion {
  return [
    Math.min(...regions.map((region) => region[0])),
    Math.min(...regions.map((region) => region[1])),
    Math.max(...regions.map((region) => region[2])),
    Math.max(...regions.map((region) => region[3])),
  ];
}

function angularDistance(left: number, right: number) {
  const difference = Math.abs(normalizeRotation(left) - normalizeRotation(right));
  return Math.min(difference, 360 - difference);
}

export function reconstructTextLines(spans: CoordinateTextSpan[]): ReconstructedTextLine[] {
  const nonEmpty = spans.filter((span) => span.normalizedText);
  const groups: Array<{ rotation: number; lineCoordinate: number; spans: CoordinateTextSpan[] }> = [];
  for (const span of nonEmpty) {
    const angle = (span.textRotation * Math.PI) / 180;
    const centerX = (span.region[0] + span.region[2]) / 2;
    const centerY = (span.region[1] + span.region[3]) / 2;
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const lineCoordinate = centerX * normalX + centerY * normalY;
    const tolerance = Math.max(0.004, (span.region[3] - span.region[1]) * 0.6);
    const group = groups.find((candidate) => (
      angularDistance(candidate.rotation, span.textRotation) <= 5
      && Math.abs(candidate.lineCoordinate - lineCoordinate) <= tolerance
    ));
    if (group) {
      group.spans.push(span);
      group.lineCoordinate = group.spans.reduce((total, item) => {
        const itemAngle = (item.textRotation * Math.PI) / 180;
        const itemCenterX = (item.region[0] + item.region[2]) / 2;
        const itemCenterY = (item.region[1] + item.region[3]) / 2;
        return total + itemCenterX * -Math.sin(itemAngle) + itemCenterY * Math.cos(itemAngle);
      }, 0) / group.spans.length;
    } else {
      groups.push({ rotation: span.textRotation, lineCoordinate, spans: [span] });
    }
  }

  return groups
    .map((group) => {
      const angle = (group.rotation * Math.PI) / 180;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const ordered = [...group.spans].sort((left, right) => {
        const leftCenterX = (left.region[0] + left.region[2]) / 2;
        const leftCenterY = (left.region[1] + left.region[3]) / 2;
        const rightCenterX = (right.region[0] + right.region[2]) / 2;
        const rightCenterY = (right.region[1] + right.region[3]) / 2;
        return (leftCenterX * directionX + leftCenterY * directionY)
          - (rightCenterX * directionX + rightCenterY * directionY);
      });
      return {
        text: ordered.map((span) => span.text).join(' ').replace(/\s+/g, ' ').trim(),
        normalizedText: ordered.map((span) => span.normalizedText).join(' ').replace(/\s+/g, ' ').trim(),
        region: unionNormalizedRegions(ordered.map((span) => span.region)),
        spanReadingOrders: ordered.map((span) => span.readingOrder),
        rotationDegrees: group.rotation,
      } satisfies ReconstructedTextLine;
    })
    .sort((left, right) => left.region[1] - right.region[1] || left.region[0] - right.region[0]);
}

export async function splitPdfToCanonicalPages({
  sourceBytes,
  sourceFileId,
  sourceFilename,
  pageLimit = 100,
}: {
  sourceBytes: Buffer;
  sourceFileId: string;
  sourceFilename: string;
  pageLimit?: number;
}): Promise<CanonicalPdfPage[]> {
  const sourceFileHash = sha256Hex(sourceBytes);
  const sourceDocument = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  const pageCount = sourceDocument.getPageCount();
  if (pageCount < 1) throw new Error(`${sourceFilename} contains no PDF pages.`);
  if (pageCount > pageLimit) throw new Error(`${sourceFilename} contains ${pageCount} pages; the limit is ${pageLimit}.`);

  const pages: CanonicalPdfPage[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const sourcePage = sourceDocument.getPage(index);
    const mediaBox = sourcePage.getMediaBox();
    const cropBox = sourcePage.getCropBox();
    const rotationDegrees = normalizeRotation(sourcePage.getRotation().angle);
    const pageDocument = await PDFDocument.create({ updateMetadata: false });
    const [copiedPage] = await pageDocument.copyPages(sourceDocument, [index]);
    pageDocument.addPage(copiedPage);
    const bytes = Buffer.from(await pageDocument.save({
      addDefaultPage: false,
      useObjectStreams: false,
      updateFieldAppearances: false,
    }));
    const sourcePageNumber = index + 1;
    pages.push({
      pageId: `pdf-page-${sha256Hex(`${sourceFileHash}\0${sourcePageNumber}`).slice(0, 32)}`,
      sourceFileId,
      sourceFilename: path.basename(sourceFilename),
      sourceFileHash,
      sourcePageNumber,
      sourcePageCount: pageCount,
      mimeType: 'application/pdf',
      bytes,
      contentHash: sha256Hex(bytes),
      mediaBox,
      cropBox,
      widthPoints: cropBox.width,
      heightPoints: cropBox.height,
      rotationDegrees,
    });
  }
  return pages;
}

export async function extractCoordinateAwarePdfText(pdfBytes: Buffer): Promise<CoordinateAwarePageText> {
  const document = await loadPdfJsDocument(pdfBytes);
  try {
    if (document.numPages !== 1) throw new Error('Coordinate extraction requires a canonical single-page PDF.');
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
    const content = await page.getTextContent({ disableNormalization: true });
    const spans = content.items.flatMap((item, index): CoordinateTextSpan[] => {
      if (!('str' in item) || !item.str.trim() || item.transform.length !== 6) return [];
      const style = content.styles[item.fontName] ?? {};
      const displayed = displayRegionForTextItem(item, style, viewport);
      return [{
        text: item.str,
        normalizedText: normalizeCadText(item.str),
        pageNumber: 1,
        region: displayed.region,
        pdfRegion: pdfRegionForTextItem(item),
        rawTransform: item.transform as [number, number, number, number, number, number],
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        pageRotation: page.rotate,
        textRotation: displayed.textRotation,
        readingOrder: index,
        fontName: item.fontName || null,
        fontFamily: style.fontFamily ?? null,
        fontAscent: style.ascent ?? null,
        fontDescent: style.descent ?? null,
        vertical: Boolean(style.vertical),
        direction: item.dir || null,
        extractionMethod: 'embedded_text',
        confidence: null,
      }];
    });
    return {
      pageNumber: 1,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      pageRotation: page.rotate,
      rawText: spans.map((span) => span.text).join(' '),
      spans,
      lines: reconstructTextLines(spans),
      extractionMethod: 'embedded_text',
    };
  } finally {
    await document.cleanup?.();
    await document.destroy();
  }
}

export async function renderPdfPreview(
  pdfBytes: Buffer,
  options: { maxDimension?: number; maxScale?: number } = {},
): Promise<PreviewArtifact> {
  const document = await loadPdfJsDocument(pdfBytes);
  try {
    if (document.numPages !== 1) throw new Error('Preview rendering requires a canonical single-page PDF.');
    const page = await document.getPage(1);
    const baseViewport = page.getViewport({ scale: 1, rotation: page.rotate });
    const maxDimension = Math.max(256, options.maxDimension ?? 2_400);
    const maxScale = Math.max(0.25, options.maxScale ?? 2);
    const scale = Math.max(0.25, Math.min(maxScale, maxDimension / Math.max(baseViewport.width, baseViewport.height)));
    const viewport = page.getViewport({ scale, rotation: page.rotate });
    const factory = new PdfCanvasFactory();
    const target = factory.create(viewport.width, viewport.height);
    try {
      await page.render({ canvasContext: target.context, viewport, canvasFactory: factory }).promise;
      const bytes = Buffer.from(await target.canvas.encode('png'));
      return {
        mimeType: 'image/png',
        bytes,
        width: target.canvas.width,
        height: target.canvas.height,
        hash: sha256Hex(bytes),
      };
    } finally {
      page.cleanup?.();
      factory.destroy(target);
    }
  } finally {
    await document.cleanup?.();
    await document.destroy();
  }
}

export async function cropPreview(
  preview: PreviewArtifact | Buffer,
  region: DrawingImportNormalizedRegion,
): Promise<CropArtifact> {
  if (region.some((value) => !Number.isFinite(value)) || region[0] < 0 || region[1] < 0 || region[2] > 1 || region[3] > 1) {
    throw new Error('Crop region must use normalized coordinates between 0 and 1.');
  }
  if (region[2] <= region[0] || region[3] <= region[1]) throw new Error('Crop region must have positive width and height.');
  const bytes = Buffer.isBuffer(preview) ? preview : preview.bytes;
  const metadata = await sharp(bytes, { failOn: 'none' }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Preview dimensions are unavailable.');
  const left = Math.max(0, Math.floor(region[0] * metadata.width));
  const top = Math.max(0, Math.floor(region[1] * metadata.height));
  const right = Math.min(metadata.width, Math.ceil(region[2] * metadata.width));
  const bottom = Math.min(metadata.height, Math.ceil(region[3] * metadata.height));
  const cropped = await sharp(bytes, { failOn: 'none' })
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  return {
    mimeType: 'image/png',
    bytes: cropped,
    width: right - left,
    height: bottom - top,
    hash: sha256Hex(cropped),
    region,
  };
}
