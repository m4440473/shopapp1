import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { buildPageDuplicateHashes } from '../document.hash';
import {
  cropPreview,
  extractCoordinateAwarePdfText,
  normalizeCadText,
  reconstructTextLines,
  renderPdfPreview,
  resolvePdfJsStandardFontDataUrl,
  splitPdfToCanonicalPages,
} from '../document.pdf';
import type { CoordinateTextSpan } from '../document.types';
import { createSyntheticPacket } from './document.test-support';

function testSpan(overrides: Partial<CoordinateTextSpan>): CoordinateTextSpan {
  return {
    text: 'TEXT',
    normalizedText: 'TEXT',
    pageNumber: 1,
    region: [0.1, 0.1, 0.2, 0.12],
    pdfRegion: [0, 0, 10, 2],
    rawTransform: [1, 0, 0, 1, 0, 0],
    pageWidth: 100,
    pageHeight: 100,
    pageRotation: 0,
    textRotation: 0,
    readingOrder: 0,
    fontName: null,
    fontFamily: null,
    fontAscent: null,
    fontDescent: null,
    vertical: false,
    direction: 'ltr',
    extractionMethod: 'embedded_text',
    confidence: null,
    ...overrides,
  };
}

describe('Drawing Import V2 PDF foundation', () => {
  it('resolves the PDF.js standard-font directory as a runtime filesystem path', () => {
    const standardFontDataUrl = resolvePdfJsStandardFontDataUrl();
    expect(standardFontDataUrl).toMatch(/pdfjs-dist\/standard_fonts\/$/);
    expect(standardFontDataUrl).not.toContain('15754');
  });

  it('creates deterministic vector single-page PDFs with exact source mapping', async () => {
    const sourceBytes = await createSyntheticPacket();
    const first = await splitPdfToCanonicalPages({ sourceBytes, sourceFileId: 'source-1', sourceFilename: 'packet.pdf' });
    const second = await splitPdfToCanonicalPages({ sourceBytes, sourceFileId: 'source-1', sourceFilename: 'packet.pdf' });

    expect(first).toHaveLength(2);
    expect(first.map((page) => page.sourcePageNumber)).toEqual([1, 2]);
    expect(first.map((page) => page.sourcePageCount)).toEqual([2, 2]);
    expect(first[1]).toMatchObject({ rotationDegrees: 90, widthPoints: 792, heightPoints: 1224 });
    expect(first.map((page) => page.contentHash)).toEqual(second.map((page) => page.contentHash));
    for (const page of first) {
      await expect(PDFDocument.load(page.bytes, { updateMetadata: false })).resolves.toSatisfy((document: PDFDocument) => document.getPageCount() === 1);
    }
  });

  it('retains coordinate, rotation, font, raw text, and normalized text evidence', async () => {
    const [page, rotatedPage] = await splitPdfToCanonicalPages({
      sourceBytes: await createSyntheticPacket(),
      sourceFileId: 'source-1',
      sourceFilename: 'packet.pdf',
    });
    const text = await extractCoordinateAwarePdfText(page.bytes);
    const rotatedText = await extractCoordinateAwarePdfText(rotatedPage.bytes);

    expect(text.rawText).toContain('PART-100');
    expect(text.lines.some((line) => line.normalizedText.includes('PART-100'))).toBe(true);
    expect(text.spans.every((span) => span.region.every((value) => value >= 0 && value <= 1))).toBe(true);
    expect(text.spans.some((span) => span.fontName && span.fontFamily)).toBe(true);
    expect(text.spans.every((span) => span.rawTransform.length === 6 && span.extractionMethod === 'embedded_text')).toBe(true);
    expect(rotatedText.pageRotation).toBe(90);
    expect(rotatedText.spans.every((span) => span.pageRotation === 90 && span.region.every((value) => value >= 0 && value <= 1))).toBe(true);
  });

  it('reconstructs lines geometrically instead of using object order', () => {
    const lines = reconstructTextLines([
      testSpan({ text: '100', normalizedText: '100', region: [0.25, 0.1, 0.3, 0.12], readingOrder: 0 }),
      testSpan({ text: 'PART', normalizedText: 'PART', region: [0.1, 0.1, 0.2, 0.12], readingOrder: 1 }),
      testSpan({ text: 'MATERIAL', normalizedText: 'MATERIAL', region: [0.1, 0.2, 0.2, 0.22], readingOrder: 2 }),
    ]);
    expect(lines.map((line) => line.text)).toEqual(['PART 100', 'MATERIAL']);
  });

  it('normalizes common CAD glyphs while preserving raw source separately', () => {
    expect(normalizeCadText('  ½—⌀  ')).toBe('1/2-Ø');
  });

  it('renders bounded previews, reproducible crops, and duplicate hashes', async () => {
    const sourceBytes = await createSyntheticPacket();
    const [page] = await splitPdfToCanonicalPages({ sourceBytes, sourceFileId: 'source-1', sourceFilename: 'packet.pdf' });
    const preview = await renderPdfPreview(page.bytes, { maxDimension: 1_200, maxScale: 2 });
    const crop = await cropPreview(preview, [0.5, 0.5, 1, 1]);
    const hashes = await buildPageDuplicateHashes({ sourceBytes, pageBytes: page.bytes, previewBytes: preview.bytes });

    expect(Math.max(preview.width, preview.height)).toBeLessThanOrEqual(1_200);
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
    expect(hashes.sourceHash).toHaveLength(64);
    expect(hashes.pageContentHash).toBe(page.contentHash);
    expect(hashes.normalizedRenderHash).toHaveLength(64);
    expect(hashes.perceptualHash).toHaveLength(16);
  });
});
