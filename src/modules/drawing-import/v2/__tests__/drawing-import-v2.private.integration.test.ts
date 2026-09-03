import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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

const privateZip = process.env.DRAWING_IMPORT_V2_PRIVATE_ZIP?.trim();
const runPrivate = Boolean(privateZip);
const terminalStatuses = new Set(['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED', 'COMPLETE']);

describe.skipIf(!runPrivate)('Drawing Import V2 private packet smoke', () => {
  afterAll(async () => {
    if (runtime.attachmentRoot) await rm(runtime.attachmentRoot, { recursive: true, force: true });
  });

  it('processes the private quote packet durably with page and source traceability', async () => {
    runtime.attachmentRoot = await mkdtemp(path.join(os.tmpdir(), 'shopapp-v2-private-'));
    const filename = path.basename(privateZip!);
    const buffer = await readFile(privateZip!);
    const started = await createQuoteDrawingImportV2Job({
      createdById: null,
      business: 'Sterling Tool and Die',
      customerName: 'Private V2 Smoke Customer',
      draftReference: `PRIVATE-V2-${Date.now()}`,
      intakeMode: 'ASSEMBLY',
      assemblyMultiplier: 2,
      filename,
      mimeType: 'application/zip',
      buffer,
    });

    let snapshot = started;
    const deadline = Date.now() + 12 * 60_000;
    while (!terminalStatuses.has(snapshot.progress.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      snapshot = await getQuoteDrawingImportV2JobSnapshot(snapshot.progress.jobId);
    }

    expect(terminalStatuses.has(snapshot.progress.status)).toBe(true);
    expect(snapshot.progress.status).not.toBe('FAILED');
    expect(snapshot.progress.status).not.toBe('CANCELLED');
    expect(snapshot.pages).toHaveLength(9);
    expect(snapshot.pages.every((page) => page.canonicalSource?.mimeType === 'application/pdf')).toBe(true);
    expect(snapshot.pages.some((page) => page.extraction !== null)).toBe(true);
    expect(snapshot.supportingFiles.some((file) => file.label === filename)).toBe(true);
    expect(snapshot.supportingFiles.filter((file) => /\.(slddrw|sldprt)$/i.test(file.label))).toHaveLength(10);
    expect(snapshot.progress.actualCostUsd).toBeLessThanOrEqual(8);
  }, 13 * 60_000);
});
