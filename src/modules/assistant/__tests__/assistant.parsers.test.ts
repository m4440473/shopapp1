import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
const require = createRequire(import.meta.url);
const { parseFile, contained } = require('../../../../scripts/assistant-index.cjs');

describe('local document parsers', () => {
  let root: string;
  beforeAll(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'shop-parser-fixture-')); });
  afterAll(async () => { if (root && path.basename(root).startsWith('shop-parser-fixture-')) await rm(root, { recursive: true, force: true }); });
  it('extracts PDF text with page attribution', async () => {
    const doc = await PDFDocument.create(); const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Part PJ1407 Material 4140 Hardened 50 HRC. This fixture contains selectable text for a machining drawing and its original notes.', { x: 30, y: 700, size: 9, font });
    const file = path.join(root, 'drawing.pdf'); await writeFile(file, await doc.save());
    const parsed = await parseFile(file); expect(parsed.text).toContain('PJ1407'); expect(parsed.text).toContain('[Page 1]'); expect(parsed.method).toBe('PDF text');
  });
  it('extracts text from an image with offline OCR', async () => {
    const canvas = createCanvas(1600, 400); const context = canvas.getContext('2d');
    context.fillStyle = 'white'; context.fillRect(0, 0, 1600, 400); context.fillStyle = 'black'; context.font = '60px Arial'; context.fillText('PART PJ1407 MATERIAL 4140', 60, 180);
    const file = path.join(root, 'drawing.png'); await writeFile(file, canvas.toBuffer('image/png'));
    const parsed = await parseFile(file); expect(parsed.text).toContain('4140'); expect(parsed.method).toContain('OCR');
  }, 60000);
  it('reads DXF labels and STEP names without pretending to solve geometry', async () => {
    const dxf = path.join(root, 'part.dxf'); await writeFile(dxf, '0\nSECTION\n2\nENTITIES\n0\nTEXT\n1\nPJ1407 4140 HARDENED\n0\nENDSEC\n0\nEOF\n');
    const parsed = await parseFile(dxf); expect(parsed.text).toContain('PJ1407'); expect(parsed.state).toBe('partial');
    const step = path.join(root, 'part.step'); await writeFile(step, "ISO-10303-21; DATA; #1=PRODUCT('PJ1407','4140 shaft','',()); ENDSEC; END-ISO-10303-21;");
    expect((await parseFile(step)).text).toContain('4140 shaft');
    const dwg = path.join(root, 'part.dwg'); await writeFile(dwg, 'AC1032'); expect((await parseFile(dwg)).state).toBe('unsupported');
  });
  it('rejects paths outside the registered attachment root', () => {
    expect(contained('C:\\ShopApp\\storage', 'C:\\ShopApp\\config\\.env')).toBe(false);
    expect(contained('C:\\ShopApp\\storage', 'C:\\ShopApp\\storage2\\a.pdf')).toBe(false);
    expect(contained('C:\\ShopApp\\storage', 'C:\\ShopApp\\storage\\a.pdf')).toBe(true);
  });
});
