import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const protocolVersion = 1;
const require = createRequire(import.meta.url);
const standardFontDataUrl = `${path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/')}/`;

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function clampCrop(region, width, height) {
  if (!Array.isArray(region) || region.length !== 4 || region.some((value) => !Number.isFinite(value))) {
    throw new Error('Crop region is invalid.');
  }
  if (region[0] < 0 || region[1] < 0 || region[2] > 1 || region[3] > 1 || region[2] <= region[0] || region[3] <= region[1]) {
    throw new Error('Crop region must be positive normalized coordinates.');
  }
  const left = Math.max(0, Math.floor(region[0] * width));
  const top = Math.max(0, Math.floor(region[1] * height));
  const right = Math.min(width, Math.ceil(region[2] * width));
  const bottom = Math.min(height, Math.ceil(region[3] * height));
  return { left, top, width: right - left, height: bottom - top };
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function canvasFactory() {
  return {
    create(width, height) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(target, width, height) {
      target.canvas.width = Math.ceil(width);
      target.canvas.height = Math.ceil(height);
    },
    destroy(target) {
      target.canvas.width = 0;
      target.canvas.height = 0;
      target.canvas = null;
      target.context = null;
    },
  };
}

async function analyzePdfPage(request) {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(request.inputPath)),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl,
  }).promise;
  try {
    if (document.numPages !== 1) throw new Error('Document worker accepts only canonical single-page PDFs.');
    const page = await document.getPage(1);
    try {
      const baseViewport = page.getViewport({ scale: 1, rotation: page.rotate });
      const maxDimension = Math.max(256, Number(request.previewMaxDimension) || 2400);
      const maxScale = Math.max(0.25, Number(request.previewMaxScale) || 2);
      const scale = Math.max(0.25, Math.min(maxScale, maxDimension / Math.max(baseViewport.width, baseViewport.height)));
      const viewport = page.getViewport({ scale, rotation: page.rotate });
      const text = await page.getTextContent({ disableNormalization: true });
      const factory = canvasFactory();
      const target = factory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: target.context, viewport, canvasFactory: factory }).promise;
        const previewBytes = Buffer.from(await target.canvas.encode('png'));
        await ensureParent(request.previewOutputPath);
        await writeFile(request.previewOutputPath, previewBytes);
        const crops = [];
        for (const cropRequest of request.crops ?? []) {
          const crop = clampCrop(cropRequest.region, target.canvas.width, target.canvas.height);
          const cropCanvas = createCanvas(crop.width, crop.height);
          try {
            cropCanvas.getContext('2d').drawImage(
              target.canvas,
              crop.left,
              crop.top,
              crop.width,
              crop.height,
              0,
              0,
              crop.width,
              crop.height,
            );
            const cropBytes = Buffer.from(await cropCanvas.encode('png'));
            await ensureParent(cropRequest.outputPath);
            await writeFile(cropRequest.outputPath, cropBytes);
            crops.push({
              cropId: cropRequest.cropId,
              path: cropRequest.outputPath,
              width: crop.width,
              height: crop.height,
              hash: sha256(cropBytes),
            });
          } finally {
            cropCanvas.width = 0;
            cropCanvas.height = 0;
          }
        }
        return {
          page: {
            width: baseViewport.width,
            height: baseViewport.height,
            rotation: page.rotate,
            userUnit: page.userUnit,
            view: page.view,
            textItems: text.items.flatMap((item) => {
              if (!('str' in item)) return [];
              const style = text.styles[item.fontName] ?? {};
              return [{
                text: item.str,
                direction: item.dir || null,
                transform: item.transform,
                width: item.width,
                height: item.height,
                fontName: item.fontName || null,
                hasEol: Boolean(item.hasEOL),
                fontFamily: style.fontFamily ?? null,
                fontAscent: style.ascent ?? null,
                fontDescent: style.descent ?? null,
                vertical: Boolean(style.vertical),
              }];
            }),
            preview: {
              path: request.previewOutputPath,
              width: target.canvas.width,
              height: target.canvas.height,
              hash: sha256(previewBytes),
            },
            crops,
          },
        };
      } finally {
        factory.destroy(target);
      }
    } finally {
      page.cleanup?.();
    }
  } finally {
    await document.cleanup?.();
    await document.destroy();
  }
}

let request;
try {
  request = JSON.parse(await readStandardInput());
  if (request.protocolVersion !== protocolVersion || typeof request.requestId !== 'string') {
    throw new Error('Unsupported document-worker protocol.');
  }
  const result = request.action === 'ping'
    ? { pong: true }
    : request.action === 'analyze_pdf_page'
      ? await analyzePdfPage(request)
      : (() => { throw new Error(`Unsupported document-worker action: ${request.action}.`); })();
  process.stdout.write(JSON.stringify({ protocolVersion, requestId: request.requestId, ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    protocolVersion,
    requestId: request?.requestId ?? 'unknown',
    ok: false,
    error: error instanceof Error ? error.message : 'Document worker failed.',
  }));
}
