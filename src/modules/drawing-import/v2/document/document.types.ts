import type { DrawingImportNormalizedRegion } from '../drawing-import-v2.types';

export const DRAWING_ARCHIVE_LIMITS = {
  maxArchiveBytes: 100 * 1024 * 1024,
  maxScannedEntries: 1_000,
  maxDrawingEntries: 100,
  maxEntryBytes: 20 * 1024 * 1024,
  maxExpandedArchiveBytes: 100 * 1024 * 1024,
  maxExpandedDrawingBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 200,
} as const;

export type DrawingDocumentMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

export type ArchiveEntryDisposition =
  | 'drawing'
  | 'supporting_solidworks'
  | 'ignored';

export type DrawingArchiveEntry = {
  id: string;
  archivePath: string;
  filename: string;
  extension: string;
  disposition: ArchiveEntryDisposition;
  declaredCompressedBytes: number;
  declaredUncompressedBytes: number;
  unixPermissions: number | null;
  collisionIndex: number;
};

export type DrawingArchiveInventory = {
  archiveHash: string;
  entries: DrawingArchiveEntry[];
  drawingCount: number;
  supportingSolidWorksCount: number;
  ignoredCount: number;
};

export type ExtractedDrawingArchiveEntry = DrawingArchiveEntry & {
  disposition: 'drawing';
  mimeType: DrawingDocumentMimeType;
  bytes: Buffer;
  contentHash: string;
};

export type ExtractedSupportingSolidWorksEntry = DrawingArchiveEntry & {
  disposition: 'supporting_solidworks';
  mimeType: 'application/octet-stream';
  bytes: Buffer;
  contentHash: string;
};

export type PdfBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanonicalPdfPage = {
  pageId: string;
  sourceFileId: string;
  sourceFilename: string;
  sourceFileHash: string;
  sourcePageNumber: number;
  sourcePageCount: number;
  mimeType: 'application/pdf';
  bytes: Buffer;
  contentHash: string;
  mediaBox: PdfBox;
  cropBox: PdfBox;
  widthPoints: number;
  heightPoints: number;
  rotationDegrees: number;
};

export type CoordinateTextSpan = {
  text: string;
  normalizedText: string;
  pageNumber: number;
  region: DrawingImportNormalizedRegion;
  pdfRegion: readonly [number, number, number, number];
  rawTransform: readonly [number, number, number, number, number, number];
  pageWidth: number;
  pageHeight: number;
  pageRotation: number;
  textRotation: number;
  readingOrder: number;
  fontName: string | null;
  fontFamily: string | null;
  fontAscent: number | null;
  fontDescent: number | null;
  vertical: boolean;
  direction: string | null;
  extractionMethod: 'embedded_text' | 'ocr';
  confidence: number | null;
};

export type ReconstructedTextLine = {
  text: string;
  normalizedText: string;
  region: DrawingImportNormalizedRegion;
  spanReadingOrders: number[];
  rotationDegrees: number;
};

export type CoordinateAwarePageText = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  pageRotation: number;
  rawText: string;
  spans: CoordinateTextSpan[];
  lines: ReconstructedTextLine[];
  extractionMethod: 'embedded_text' | 'ocr';
};

export type PageDuplicateHashes = {
  sourceHash: string;
  pageContentHash: string;
  normalizedRenderHash: string | null;
  perceptualHash: string | null;
};

export type PreviewArtifact = {
  mimeType: 'image/png';
  bytes: Buffer;
  width: number;
  height: number;
  hash: string;
};

export type CropArtifact = PreviewArtifact & {
  region: DrawingImportNormalizedRegion;
};

export type OcrSpan = CoordinateTextSpan & {
  extractionMethod: 'ocr';
  confidence: number;
};

export type OcrResult = {
  engine: string;
  language: string;
  rawText: string;
  rawTsv: string | null;
  confidence: number | null;
  spans: OcrSpan[];
  warnings: string[];
};

export interface OcrEngine {
  readonly name: string;
  readonly enabled: boolean;
  recognize(image: Buffer, options?: { signal?: AbortSignal }): Promise<OcrResult>;
  close(): Promise<void>;
}
