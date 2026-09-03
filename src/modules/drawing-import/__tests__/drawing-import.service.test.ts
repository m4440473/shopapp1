import { File } from 'node:buffer';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { expandDrawingUpload, extractPurchaseOrderNumberFromText, getPacketPageFilename, getPdfTextPageScanCount, isSupportedDrawingFilename, mapWithConcurrency, PDF_TEXT_CHARACTER_LIMIT, resolveDraftDrawingPreview, shouldCreatePartFromDocumentRole, shouldIncludeUploadedBomContext, splitMultiPagePdfDrawing } from '../drawing-import.service';
import { buildDrawingImportDraftStorageKey, clearDrawingImportDraft, readDrawingImportDraft, writeDrawingImportDraft } from '../drawing-import.draft';
import { bestMaterialMatch, buildFinishPartNotes, deriveCutAndStockLength, parseDrawingQuantityInput, parseInchMeasurement } from '../drawing-import.materials';
import { getDrawingConfirmationNeeds } from '../drawing-import.review';

function createBlankPdf(pageCount: number) {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, index) => `${3 + index * 2} 0 R`).join(' ')}] >>`,
  ];
  for (let index = 0; index < pageCount; index += 1) {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${contentId} 0 R >>`);
    objects.push('<< /Length 0 >>\nstream\n\nendstream');
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe('drawing import file handling', () => {
  it('recognizes supported drawing files without treating ZIP as a drawing', () => {
    expect(isSupportedDrawingFilename('PART-100.PDF')).toBe(true);
    expect(isSupportedDrawingFilename('part.png')).toBe(true);
    expect(isSupportedDrawingFilename('drawings.zip')).toBe(false);
    expect(isSupportedDrawingFilename('notes.txt')).toBe(false);
  });

  it('expands a ZIP into individually mapped drawings and ignores unsupported files', async () => {
    const zip = new JSZip();
    zip.file('nested/PART-001.pdf', Buffer.from('%PDF-1.4 test'));
    zip.file('PART-002.png', Buffer.from('image'));
    zip.file('notes.txt', Buffer.from('ignore'));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const upload = new File([buffer], 'fwdfiles.zip', { type: 'application/zip' });
    const files = await expandDrawingUpload(upload as unknown as globalThis.File);

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.filename)).toEqual(['PART-001.pdf', 'PART-002.png']);
  });

  it('rejects suspiciously compressed drawing entries before expansion', async () => {
    const zip = new JSZip();
    zip.file('suspicious.pdf', Buffer.alloc(1024 * 1024));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const upload = new File([buffer], 'drawings.zip', { type: 'application/zip' });

    await expect(expandDrawingUpload(upload as unknown as globalThis.File)).rejects.toThrow('unsafe compression ratio');
  });

  it('resolves a stored draft drawing for preview without allowing path traversal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'drawing-preview-'));
    try {
      const relativePath = 'business/customer/draft-id/PART-100.pdf';
      const absolutePath = path.join(root, ...relativePath.split('/'));
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, Buffer.from('%PDF-1.4 preview'));

      await expect(resolveDraftDrawingPreview(relativePath, root)).resolves.toMatchObject({
        absolutePath,
        filename: 'PART-100.pdf',
        mimeType: 'application/pdf',
      });
      await expect(resolveDraftDrawingPreview('../outside.pdf', root)).rejects.toThrow('Drawing not found');
      await expect(resolveDraftDrawingPreview('business/customer/draft-id/notes.txt', root)).rejects.toThrow('Drawing not found');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['6061', '6061-T6'],
    ['ALUMINUM 6061-T6511', '6061-T6'],
    ['C.R.S.', '1018 CRS'],
    ['Cold rolled steel', '1018 CRS'],
    ['1018 cold roll steel', '1018 CRS'],
    ['304 stainless steel', '304 SS'],
    ['Teflon', 'PTFE / Teflon'],
  ])('matches shop material name %s to %s', (drawingValue, expectedName) => {
    const materials = [
      { id: 'crs', name: '1018 CRS' },
      { id: 'aluminum', name: '6061-T6' },
      { id: 'stainless-spaced', name: '304 SS' },
      { id: 'stainless-compact', name: '304SS' },
      { id: 'ptfe', name: 'PTFE / Teflon' },
    ];
    const matchedId = bestMaterialMatch(drawingValue, materials);
    expect(materials.find((material) => material.id === matchedId)?.name).toBe(expectedName);
  });

  it('formats an extracted finish for the part notes without inventing one', () => {
    expect(buildFinishPartNotes(' ZINC PLATE ')).toBe('Finish: ZINC PLATE');
    expect(buildFinishPartNotes(null)).toBe('');
  });

  it('extracts a labeled purchase-order number without treating nearby headings as the number', () => {
    expect(extractPurchaseOrderNumberFromText('PURCHASE ORDER\nPO Number: TOY-48731\nDate: 08/26/2026')).toBe('TOY-48731');
    expect(extractPurchaseOrderNumberFromText('P.O. # 001923-A')).toBe('001923-A');
    expect(extractPurchaseOrderNumberFromText('PURCHASE ORDER DATE 08/26/2026')).toBeNull();
  });

  it('derives deterministic cut and total stock lengths from final length and quantity', () => {
    expect(parseInchMeasurement('2 1/2"')).toBe(2.5);
    expect(deriveCutAndStockLength('2 1/2"', 4)).toEqual({ cutLength: '2.625', stockLength: '10.5' });
    expect(deriveCutAndStockLength('', 4)).toEqual({ cutLength: '', stockLength: '' });
  });

  it('accepts a manually replaced drawing quantity without coercing an empty draft to one', () => {
    expect(parseDrawingQuantityInput('')).toBeNull();
    expect(parseDrawingQuantityInput('12')).toBe(12);
    expect(parseDrawingQuantityInput('0')).toBeNull();
    expect(parseDrawingQuantityInput('2.5')).toBeNull();
  });

  it('bounds concurrent drawing work while preserving input order', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([5, 4, 3, 2, 1], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value * 10;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(result).toEqual([50, 40, 30, 20, 10]);
  });

  it('routes uploaded BOM context only to drawings that reference or contain a BOM', () => {
    expect(shouldIncludeUploadedBomContext('DETAIL-100.pdf', 'MATERIAL: SEE BOM')).toBe(true);
    expect(shouldIncludeUploadedBomContext('ASSEMBLY-BOM.pdf', 'GENERAL NOTES')).toBe(true);
    expect(shouldIncludeUploadedBomContext('DETAIL-200.pdf', 'MATERIAL: 6061-T6')).toBe(false);
  });

  it('scans deeper assembly PDFs while keeping PDF text extraction bounded', () => {
    expect(getPdfTextPageScanCount(8)).toBe(8);
    expect(getPdfTextPageScanCount(92)).toBe(20);
    expect(PDF_TEXT_CHARACTER_LIMIT).toBe(80_000);
  });

  it('splits a multi-page PDF packet into traceable page images', async () => {
    const pages = await splitMultiPagePdfDrawing({
      filename: 'customer-packet.pdf',
      mimeType: 'application/pdf',
      buffer: createBlankPdf(3),
    });

    expect(pages).toHaveLength(3);
    expect(pages?.map((page) => page.filename)).toEqual([
      'customer-packet-page-001.png',
      'customer-packet-page-002.png',
      'customer-packet-page-003.png',
    ]);
    expect(pages?.[1]).toMatchObject({
      sourceDocumentName: 'customer-packet.pdf',
      sourcePageNumber: 2,
      sourceDocumentPageCount: 3,
      mimeType: 'image/png',
    });
    expect(pages?.[0].buffer.subarray(1, 4).toString()).toBe('PNG');
  });

  it('preserves one-page PDFs and routes only drawing-like roles into parts', async () => {
    await expect(splitMultiPagePdfDrawing({ filename: 'single.pdf', mimeType: 'application/pdf', buffer: createBlankPdf(1) })).resolves.toBeNull();
    expect(getPacketPageFilename('packet.pdf', 9, 120)).toBe('packet-page-009.png');
    expect(shouldCreatePartFromDocumentRole('PART_DRAWING')).toBe(true);
    expect(shouldCreatePartFromDocumentRole('OTHER')).toBe(true);
    expect(shouldCreatePartFromDocumentRole('BOM')).toBe(false);
    expect(shouldCreatePartFromDocumentRole('COVER')).toBe(false);
  });

  it('rediscovers autosaved intake metadata after a remount with a new server draft reference', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
    const context = { destination: 'order' as const, business: 'ShopApp', customerName: 'Toyota' };
    const keyBeforeRefresh = buildDrawingImportDraftStorageKey(context);
    writeDrawingImportDraft(storage, context, { reviewed: [{ key: 'drawing-1' }], serverDraftReference: 'old-random-id' });
    const keyAfterRefresh = buildDrawingImportDraftStorageKey(context);
    expect(keyAfterRefresh).toBe(keyBeforeRefresh);
    expect(readDrawingImportDraft(storage, context)).toMatchObject({ reviewed: [{ key: 'drawing-1' }] });
    clearDrawingImportDraft(storage, context);
    expect(readDrawingImportDraft(storage, context)).toBeNull();
  });

  it('derives confirmation warnings from live values and clears them as fields are resolved', () => {
    const field = (value: string | null, confidence: number) => ({ value, confidence, evidence: null });
    const proposal = {
      key: 'drawing-1',
      filename: 'PART-100.pdf',
      mimeType: 'application/pdf',
      storagePath: 'business/customer/draft/PART-100.pdf',
      pageCount: 1,
      partNumber: field('PART-100', 0.95),
      partName: field('BRACKET', 0.6),
      quantity: { value: null, confidence: 0.2, evidence: null },
      material: field('6061', 0.9),
      finish: field('ANODIZE', 0.6),
      stockSize: field(null, 0),
      cutLength: field(null, 0),
      finalPartLength: field('4.000', 0.95),
      partWidth: field('2.000', 0.95),
      partThickness: field('0.250', 0.95),
      revision: field('A', 0.9),
      documentRole: 'PART_DRAWING' as const,
      isAssembly: false,
      warnings: [],
    };
    const part = {
      partNumber: 'PART-100',
      partName: 'BRACKET',
      quantity: 1,
      materialId: '6061-id',
      finish: 'ANODIZE',
      stockSize: '',
      cutLength: '',
      finalPartLength: '4.000',
      partWidth: '2.000',
      partThickness: '0.250',
    };

    expect(getDrawingConfirmationNeeds(part, proposal, new Set()).map((need) => need.field)).toEqual([
      'partName',
      'quantity',
      'finish',
    ]);
    expect(getDrawingConfirmationNeeds(part, proposal, new Set(['partName', 'quantity', 'finish']))).toEqual([]);
    expect(getDrawingConfirmationNeeds({ ...part, materialId: '' }, proposal, new Set(['partName', 'quantity', 'finish']))[0]).toMatchObject({
      field: 'materialId',
      resolution: 'edit',
    });
    expect(getDrawingConfirmationNeeds({ ...part, finalPartLength: 'not a length' }, proposal, new Set(['partName', 'quantity', 'finish']))).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'finalPartLength', resolution: 'edit' }),
    ]));
  });
});
