import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { createOcrEngine, parseTesseractTsv } from '../document.ocr';

describe('Drawing Import V2 OCR foundation', () => {
  it('keeps word bounding boxes, confidence, and raw text columns from TSV', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t10\t20\t80\t15\t96.5\tPART-100',
      '5\t1\t1\t1\t1\t2\t95\t20\t50\t15\t88.2\tREV A',
    ].join('\n');
    expect(parseTesseractTsv(tsv)).toEqual([
      { left: 10, top: 20, width: 80, height: 15, confidence: 96.5, text: 'PART-100' },
      { left: 95, top: 20, width: 50, height: 15, confidence: 88.2, text: 'REV A' },
    ]);
  });

  it('is disabled unless configuration explicitly enables local OCR', async () => {
    const engine = createOcrEngine({ enabled: false });
    expect(engine.enabled).toBe(false);
    await expect(engine.recognize(Buffer.from('not-an-image'))).rejects.toThrow('disabled');
    await engine.close();
  });

  it.runIf(process.env.RUN_DRAWING_OCR_SMOKE === 'true')('reads a local synthetic title block without a network language download', async () => {
    const image = await sharp(Buffer.from(`
      <svg width="1000" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="300" fill="white"/>
        <text x="40" y="130" font-family="Arial" font-size="72" fill="black">PART-100</text>
        <text x="40" y="230" font-family="Arial" font-size="54" fill="black">MATERIAL 6061-T6</text>
      </svg>
    `)).png().toBuffer();
    const engine = createOcrEngine({ enabled: true });
    try {
      const result = await engine.recognize(image);
      expect(result.rawText).toContain('PART-100');
      expect(result.spans.some((span) => span.text.includes('6061'))).toBe(true);
      expect(result.spans.every((span) => span.region.every((value) => value >= 0 && value <= 1))).toBe(true);
    } finally {
      await engine.close();
    }
  });
});
