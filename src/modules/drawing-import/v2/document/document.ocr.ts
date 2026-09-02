import { createRequire } from 'node:module';

import sharp from 'sharp';
import type { Worker } from 'tesseract.js';

import type { DrawingImportNormalizedRegion } from '../drawing-import-v2.types';
import type { OcrEngine, OcrResult, OcrSpan } from './document.types';

type TsvWord = {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  text: string;
};

function abortError() {
  const error = new Error('OCR was cancelled.');
  error.name = 'AbortError';
  return error;
}

export function parseTesseractTsv(tsv: string): TsvWord[] {
  const lines = tsv.split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).flatMap((line): TsvWord[] => {
    const columns = line.split('\t');
    if (columns.length < 12 || columns[0] !== '5') return [];
    const text = columns.slice(11).join('\t').trim();
    const left = Number(columns[6]);
    const top = Number(columns[7]);
    const width = Number(columns[8]);
    const height = Number(columns[9]);
    const confidence = Number(columns[10]);
    if (!text || ![left, top, width, height, confidence].every(Number.isFinite) || width <= 0 || height <= 0) return [];
    return [{ left, top, width, height, confidence, text }];
  });
}

function normalizedWordRegion(word: TsvWord, imageWidth: number, imageHeight: number): DrawingImportNormalizedRegion {
  return [
    Math.max(0, Math.min(1, word.left / imageWidth)),
    Math.max(0, Math.min(1, word.top / imageHeight)),
    Math.max(0, Math.min(1, (word.left + word.width) / imageWidth)),
    Math.max(0, Math.min(1, (word.top + word.height) / imageHeight)),
  ];
}

export class DisabledOcrEngine implements OcrEngine {
  readonly name = 'disabled';
  readonly enabled = false;

  async recognize(): Promise<OcrResult> {
    throw new Error('Local OCR is disabled.');
  }

  async close() {}
}

export class LocalTesseractOcrEngine implements OcrEngine {
  readonly name = 'tesseract.js-7';
  readonly enabled: boolean;
  private worker: Worker | null = null;
  private runTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: { enabled: boolean; language?: string }) {
    this.enabled = options.enabled;
  }

  private async getWorker() {
    if (!this.enabled) throw new Error('Local OCR is disabled.');
    if (this.worker) return this.worker;
    const require = createRequire(import.meta.url);
    const languageData = require('@tesseract.js-data/eng') as { langPath: string };
    const tesseract = await import('tesseract.js');
    this.worker = await tesseract.createWorker(this.options.language ?? 'eng', tesseract.OEM.LSTM_ONLY, {
      langPath: languageData.langPath,
      gzip: true,
      logger: () => undefined,
    });
    return this.worker;
  }

  private async exclusive<T>(operation: () => Promise<T>) {
    const previous = this.runTail;
    let release = () => undefined;
    this.runTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async recognize(image: Buffer, options: { signal?: AbortSignal } = {}): Promise<OcrResult> {
    return this.exclusive(async () => {
      if (options.signal?.aborted) throw abortError();
      const metadata = await sharp(image, { failOn: 'none' }).metadata();
      if (!metadata.width || !metadata.height) throw new Error('OCR image dimensions are unavailable.');
      const worker = await this.getWorker();
      const onAbort = () => {
        void worker.terminate().catch(() => undefined);
        this.worker = null;
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const result = await worker.recognize(
          image,
          { rotateAuto: true },
          { blocks: true, tsv: true },
        );
        if (options.signal?.aborted) throw abortError();
        const rawTsv = result.data.tsv ?? '';
        const rotationDegrees = result.data.rotateRadians === null
          ? 0
          : ((result.data.rotateRadians * 180) / Math.PI + 360) % 360;
        const spans: OcrSpan[] = parseTesseractTsv(rawTsv).map((word, index) => ({
          text: word.text,
          normalizedText: word.text.normalize('NFKC').replace(/\s+/g, ' ').trim(),
          pageNumber: 1,
          region: normalizedWordRegion(word, metadata.width!, metadata.height!),
          pdfRegion: [word.left, word.top, word.left + word.width, word.top + word.height],
          rawTransform: [1, 0, 0, 1, word.left, word.top],
          pageWidth: metadata.width!,
          pageHeight: metadata.height!,
          pageRotation: 0,
          textRotation: rotationDegrees,
          readingOrder: index,
          fontName: null,
          fontFamily: null,
          fontAscent: null,
          fontDescent: null,
          vertical: false,
          direction: null,
          extractionMethod: 'ocr',
          confidence: word.confidence,
        }));
        return {
          engine: this.name,
          language: this.options.language ?? 'eng',
          rawText: result.data.text,
          rawTsv: result.data.tsv,
          confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
          spans,
          warnings: [],
        };
      } finally {
        options.signal?.removeEventListener('abort', onAbort);
      }
    });
  }

  async close() {
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}

export function createOcrEngine(config: { enabled: boolean; language?: string }): OcrEngine {
  return config.enabled ? new LocalTesseractOcrEngine(config) : new DisabledOcrEngine();
}
