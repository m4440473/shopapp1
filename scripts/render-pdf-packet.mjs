import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [, , inputPath, outputDirectory] = process.argv;
if (!inputPath || !outputDirectory) throw new Error('Usage: render-pdf-packet.mjs <input.pdf> <output-directory>');

const packetPageLimit = 100;
const textPageLimit = 20;
const textCharacterLimit = 80_000;
const renderScale = 2;
const document = await pdfjs.getDocument({
  data: new Uint8Array(await readFile(inputPath)),
  useWorkerFetch: false,
  isEvalSupported: false,
}).promise;

try {
  if (document.numPages > packetPageLimit) {
    throw new Error(`PDF contains ${document.numPages} pages; the limit is ${packetPageLimit}.`);
  }

  const pages = [];
  const combinedText = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    try {
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str ?? '').join(' ').slice(0, 12_000);
      if (pageNumber <= textPageLimit) combinedText.push(pageText);

      if (document.numPages === 1) {
        pages.push({ pageNumber, text: pageText });
        continue;
      }

      const viewport = page.getViewport({ scale: renderScale });
      if (viewport.width <= 0 || viewport.height <= 0) throw new Error(`Invalid PDF page size on page ${pageNumber}.`);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      const canvasFactory = {
        create(width, height) {
          const nested = createCanvas(Math.ceil(width), Math.ceil(height));
          return { canvas: nested, context: nested.getContext('2d') };
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
      await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
      const imageFilename = `page-${String(pageNumber).padStart(3, '0')}.png`;
      await writeFile(path.join(outputDirectory, imageFilename), Buffer.from(await canvas.encode('png')));
      const cropWidth = Math.max(1, Math.ceil(canvas.width * 0.52));
      const cropHeight = Math.max(1, Math.ceil(canvas.height * 0.52));
      const cropCanvas = createCanvas(cropWidth, cropHeight);
      cropCanvas.getContext('2d').drawImage(
        canvas,
        Math.max(0, canvas.width - cropWidth),
        Math.max(0, canvas.height - cropHeight),
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
      const cropFilename = `page-${String(pageNumber).padStart(3, '0')}-title-block.png`;
      await writeFile(path.join(outputDirectory, cropFilename), Buffer.from(await cropCanvas.encode('png')));
      cropCanvas.width = 0;
      cropCanvas.height = 0;
      canvas.width = 0;
      canvas.height = 0;
      pages.push({ pageNumber, text: pageText, imageFilename, cropFilename });
    } finally {
      page.cleanup?.();
    }
  }

  await writeFile(path.join(outputDirectory, 'result.json'), JSON.stringify({
    pageCount: document.numPages,
    text: combinedText.join('\n\n').slice(0, textCharacterLimit),
    pages,
  }));
} finally {
  await document.cleanup?.();
  await document.destroy();
}
