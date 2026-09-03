import path from 'node:path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { extractDrawingArchive } from '../document.archive';
import { extractCoordinateAwarePdfText, renderPdfPreview, resolvePdfJsStandardFontDataUrl, splitPdfToCanonicalPages } from '../document.pdf';
import { createSyntheticPacket } from './document.test-support';
import { createDrawingImportAiAdapter } from '../../ai/drawing-import-ai.adapter';
import { getDrawingImportAiSettings } from '../../ai/drawing-import-ai.config';
import { DrawingImportAiBudgetController, DEFAULT_DRAWING_IMPORT_PRICING_CATALOG } from '../../ai/drawing-import-ai.pricing';
import { DrawingImportAiExtraction } from '../../ai/drawing-import-ai.schema';
import { getDrawingImportV2Config } from '../../drawing-import-v2.config';

async function singlePdf(scanned = false) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([612, 792]);
  if (scanned) {
    const image = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#cccccc' } }).png().toBuffer();
    const embedded = await pdf.embedPng(image);
    page.drawImage(embedded, { x: 30, y: 30, width: 300, height: 200 });
  } else {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('STANDALONE DRAWING', { x: 50, y: 600, font });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function uncertainResult() {
  const fields = Object.fromEntries([
    'partNumber', 'partName', 'drawingQuantity', 'material', 'finish', 'stockSize', 'cutLength',
    'finalLength', 'partWidth', 'partThickness', 'revision', 'assemblyStatus',
  ].map(name => [name, {
    value: null, rawText: null, status: 'unreadable', evidenceText: null,
    sourceRegionIdentity: null, warnings: [], diagnosticConfidence: null,
  }]));
  return DrawingImportAiExtraction.parse({
    ...fields, classification: 'uncertain', classificationEvidenceText: null,
    manufacturingNotes: [], contradictions: [], warnings: [],
  });
}

describe('New importer mixed ZIP and single-page requests', () => {
  it('finds parent dependencies from a downloaded child checkout', () => {
    const expected = resolvePdfJsStandardFontDataUrl();
    expect(resolvePdfJsStandardFontDataUrl({
      cwd: path.join(process.cwd(), 'downloaded-checkout', 'nested-source'),
    })).toBe(expected);
  });

  it('locally splits mixed PDFs and sends exactly one page in each separate model call', async () => {
    const zip = new JSZip();
    zip.file('assembly/drawing.pdf', await createSyntheticPacket());
    zip.file('detail/drawing.pdf', await singlePdf());
    zip.file('scans/scan.PDF', await singlePdf(true));
    zip.file('notes/readme.txt', 'Supporting information, not a drawing.');
    const { drawings, inventory } = await extractDrawingArchive(await zip.generateAsync({ type: 'nodebuffer' }));
    expect(inventory).toMatchObject({ drawingCount: 3, ignoredCount: 1 });
    expect(drawings.map(drawing => drawing.archivePath)).toEqual([
      'assembly/drawing.pdf', 'detail/drawing.pdf', 'scans/scan.PDF',
    ]);
    const sources = await Promise.all(drawings.map(drawing => splitPdfToCanonicalPages({
      sourceBytes: drawing.bytes, sourceFileId: drawing.id, sourceFilename: drawing.filename,
    })));
    expect(sources.map(pages => pages.length)).toEqual([2, 1, 1]);
    const pages = sources.flat();
    expect(new Set(pages.map(page => page.sourceFileId)).size).toBe(3);
    expect(pages[1]).toMatchObject({ sourcePageNumber: 2, sourcePageCount: 2, rotationDegrees: 90 });
    expect(await extractCoordinateAwarePdfText(pages[3].bytes)).toMatchObject({ rawText: '' });
    expect((await renderPdfPreview(pages[3].bytes)).bytes.length).toBeGreaterThan(0);

    const requests: Buffer[] = [];
    const parse = vi.fn(async (body: Record<string, unknown>) => {
      const input = body.input as Array<{ content: Array<{ type: string; file_data?: string; detail?: string }> }>;
      const attachments = input.flatMap(item => item.content).filter(item => item.type !== 'input_text');
      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toMatchObject({ type: 'input_file', detail: 'high' });
      const bytes = Buffer.from(attachments[0].file_data!.split(',')[1], 'base64');
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      requests.push(bytes);
      return { status: 'completed', output_parsed: uncertainResult(), output: [] };
    });
    const runtime = getDrawingImportV2Config({ DRAWING_IMPORT_V3_ENABLED: 'true', DRAWING_IMPORT_V2_RETRY_LIMIT: '5', DRAWING_IMPORT_V2_SOL: 'true' });
    const adapter = createDrawingImportAiAdapter({
      responses: { parse, countInputTokens: vi.fn(async () => ({ input_tokens: 100 })) },
      runtime, settings: getDrawingImportAiSettings({ DRAWING_IMPORT_V3_ENABLED: 'true' }),
      pricing: DEFAULT_DRAWING_IMPORT_PRICING_CATALOG,
      budget: new DrawingImportAiBudgetController(6.4, 8),
    });
    for (const page of pages) {
      const result = await adapter.runTerraFullPage({
        jobId: 'mixed-zip-test', attemptId: page.pageId, pageId: page.pageId,
        pageHash: page.contentHash, profileVersion: 'none',
        sourceFilename: page.sourceFilename, sourcePageNumber: page.sourcePageNumber,
        unresolvedFields: ['finalLength'], coordinateAwareText: '', localCandidates: [],
        bomCandidates: [], knownRegionIds: [], canonicalPagePdf: page.bytes,
      });
      expect(result.errorCode).toBeNull();
      expect(result.extraction?.finalLength.value).toBeNull();
    }
    expect(parse).toHaveBeenCalledTimes(4);
    expect(requests.map(buffer => buffer.equals(drawings[0].bytes))).toEqual([false, false, false, false]);
    expect(runtime.retryLimit).toBe(0);
    expect(runtime.solEscalationEnabled).toBe(false);
  }, 30_000);

  it('does not retry a failed V3 extraction automatically', async () => {
    const parse = vi.fn(async () => { throw Object.assign(new Error('timeout'), { status: 503 }); });
    const adapter = createDrawingImportAiAdapter({
      responses: { parse, countInputTokens: vi.fn(async () => ({ input_tokens: 100 })) },
      runtime: getDrawingImportV2Config({ DRAWING_IMPORT_V3_ENABLED: 'true' }),
      settings: getDrawingImportAiSettings({ DRAWING_IMPORT_V3_ENABLED: 'true' }),
      pricing: DEFAULT_DRAWING_IMPORT_PRICING_CATALOG,
      budget: new DrawingImportAiBudgetController(6.4, 8),
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = await adapter.runTerraFullPage({
        jobId: 'test', attemptId: 'attempt', pageId: 'page', pageHash: 'hash',
        profileVersion: 'none', sourceFilename: 'single.pdf', sourcePageNumber: 1,
        unresolvedFields: [], coordinateAwareText: '', localCandidates: [], bomCandidates: [],
        knownRegionIds: [], canonicalPagePdf: await singlePdf(),
      });
      expect(result.errorCode).toBe('request_failed');
      expect(parse).toHaveBeenCalledOnce();
    } finally {
      errorLog.mockRestore();
    }
  });
});
