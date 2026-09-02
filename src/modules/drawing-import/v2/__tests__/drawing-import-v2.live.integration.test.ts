import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ attachmentRoot: '' }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/app-settings', () => ({
  getAppSettings: async () => ({ attachmentsDir: runtime.attachmentRoot }),
}));

import {
  createQuoteDrawingImportV2Job,
  getQuoteDrawingImportV2JobSnapshot,
} from '../drawing-import-v2.service';

const runLive = process.env.RUN_DRAWING_IMPORT_V2_LIVE === 'true' && Boolean(process.env.OPENAI_API_KEY?.trim());
const terminalStatuses = new Set(['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED', 'COMPLETE']);

async function syntheticDrawing() {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([792, 612]);
  page.drawText('SYNTHETIC TEST DRAWING - NO CUSTOMER DATA', { x: 42, y: 560, size: 18, font: bold });
  page.drawRectangle({ x: 480, y: 28, width: 282, height: 145, borderWidth: 1 });
  const fields = [
    'DRAWING NO: SYN-V2-1001',
    'TITLE: SYNTHETIC DRIVE SHAFT',
    'REV: B',
    'MATERIAL: 4140 PREHARD STEEL',
    'QTY: 3',
    'FINISH: BLACK OXIDE',
    'FINAL LENGTH: 12.000 IN',
  ];
  fields.forEach((text, index) => page.drawText(text, { x: 495, y: 148 - index * 17, size: 10, font }));
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

describe.skipIf(!runLive)('Drawing Import V2 live synthetic model smoke', () => {
  afterAll(async () => {
    if (runtime.attachmentRoot) await rm(runtime.attachmentRoot, { recursive: true, force: true });
  });

  it('uses the configured Responses model and returns evidence-backed review data', async () => {
    runtime.attachmentRoot = await mkdtemp(path.join(os.tmpdir(), 'shopapp-v2-live-'));
    const started = await createQuoteDrawingImportV2Job({
      createdById: null,
      business: 'Sterling Tool and Die',
      customerName: 'Synthetic Test Customer',
      draftReference: `SYNTHETIC-LIVE-${Date.now()}`,
      intakeMode: 'ONE_OFF',
      assemblyMultiplier: 1,
      filename: 'synthetic-v2-drawing.pdf',
      mimeType: 'application/pdf',
      buffer: await syntheticDrawing(),
    });

    let snapshot = started;
    const deadline = Date.now() + 5 * 60_000;
    while (!terminalStatuses.has(snapshot.progress.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      snapshot = await getQuoteDrawingImportV2JobSnapshot(snapshot.progress.jobId);
    }

    expect(['READY_FOR_REVIEW', 'PARTIAL_FAILURE']).toContain(snapshot.progress.status);
    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.pages[0].processingStatus).toBe('ready');
    expect(snapshot.pages[0].extraction?.partNumber.value).toBe('SYN-V2-1001');
    expect(snapshot.pages[0].extraction?.drawingQuantity.value).toBe(3);
    expect(snapshot.pages[0].extraction?.route).toMatch(/terra|sol/);
    expect(snapshot.pages[0].extraction?.partNumber.evidence.length).toBeGreaterThan(0);
    expect(snapshot.progress.actualCostUsd).toBeGreaterThan(0);
    expect(snapshot.progress.actualCostUsd).toBeLessThan(1);
  }, 6 * 60_000);
});
