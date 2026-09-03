import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { BoundedDocumentWorkerPool, executeDocumentWorker } from '../document.worker-pool';
import { DOCUMENT_WORKER_PROTOCOL_VERSION } from '../document.worker-protocol';
import { splitPdfToCanonicalPages } from '../document.pdf';
import { createSyntheticPacket } from './document.test-support';

describe('Drawing Import V2 document worker', () => {
  it('uses a versioned request/response protocol', async () => {
    const requestId = randomUUID();
    await expect(executeDocumentWorker({
      protocolVersion: DOCUMENT_WORKER_PROTOCOL_VERSION,
      requestId,
      action: 'ping',
    }, { timeoutMs: 30_000 })).resolves.toMatchObject({
      protocolVersion: DOCUMENT_WORKER_PROTOCOL_VERSION,
      requestId,
      ok: true,
      result: { pong: true },
    });
  });

  it('bounds concurrent child processes and queues excess work', async () => {
    const pool = new BoundedDocumentWorkerPool({ concurrency: 1, timeoutMs: 30_000 });
    try {
      const first = pool.run({
        protocolVersion: DOCUMENT_WORKER_PROTOCOL_VERSION,
        requestId: randomUUID(),
        action: 'ping',
      });
      const second = pool.run({
        protocolVersion: DOCUMENT_WORKER_PROTOCOL_VERSION,
        requestId: randomUUID(),
        action: 'ping',
      });

      expect(pool.activeCount).toBe(1);
      expect(pool.pendingCount).toBe(1);
      await expect(Promise.all([first, second])).resolves.toHaveLength(2);
      expect(pool.activeCount).toBe(0);
      expect(pool.pendingCount).toBe(0);
    } finally {
      pool.close();
    }
  });

  it('renders a canonical page and targeted crop outside the application process', async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'drawing-v2-worker-'));
    try {
      const [page] = await splitPdfToCanonicalPages({
        sourceBytes: await createSyntheticPacket(),
        sourceFileId: 'source-1',
        sourceFilename: 'packet.pdf',
      });
      const inputPath = path.join(temporaryDirectory, 'page.pdf');
      const previewOutputPath = path.join(temporaryDirectory, 'preview.png');
      const cropOutputPath = path.join(temporaryDirectory, 'crop.png');
      await writeFile(inputPath, page.bytes);
      const response = await executeDocumentWorker({
        protocolVersion: DOCUMENT_WORKER_PROTOCOL_VERSION,
        requestId: randomUUID(),
        action: 'analyze_pdf_page',
        inputPath,
        previewOutputPath,
        previewMaxDimension: 1_000,
        previewMaxScale: 2,
        crops: [{ cropId: 'title', region: [0.5, 0.5, 1, 1], outputPath: cropOutputPath }],
      }, { timeoutMs: 60_000 });

      expect(response.result?.page?.textItems.some((item) => item.text.includes('PART-100'))).toBe(true);
      expect(response.result?.page?.preview.path).toBe(previewOutputPath);
      expect(response.result?.page?.crops).toEqual(expect.arrayContaining([expect.objectContaining({ cropId: 'title', path: cropOutputPath })]));
      expect((await readFile(previewOutputPath)).subarray(1, 4).toString()).toBe('PNG');
      expect((await readFile(cropOutputPath)).subarray(1, 4).toString()).toBe('PNG');
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
