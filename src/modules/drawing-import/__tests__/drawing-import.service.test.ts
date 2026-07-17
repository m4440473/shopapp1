import { File } from 'node:buffer';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { expandDrawingUpload, isSupportedDrawingFilename, resolveDraftDrawingPreview } from '../drawing-import.service';
import { bestMaterialMatch, buildFinishPartNotes } from '../drawing-import.materials';
import { getDrawingConfirmationNeeds } from '../drawing-import.review';

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
      revision: field('A', 0.9),
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
  });
});
