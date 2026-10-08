import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ db: null as unknown as PrismaClient, root: '' }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = runtime.db[String(key)];
  return typeof value === 'function' ? value.bind(runtime.db) : value;
} }) }));

import { createDrawingImportBomRows, replaceDrawingImportBomEdges } from '../drawing-import-v2.repo';
import { reconstructBomTable } from '../bom/bom-table';

beforeAll(async () => {
  runtime.root = await mkdtemp(path.join(os.tmpdir(), 'shopapp-bom-repo-'));
  await writeFile(path.join(runtime.root, 'test.db'), '');
  const url = `file:${path.join(runtime.root, 'test.db').replaceAll('\\', '/')}`;
  const require = createRequire(import.meta.url);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', require.resolve('.prisma/client/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: url }, timeout: 60000, stdio: 'pipe',
  });
  runtime.db = new PrismaClient({ datasources: { db: { url } } });
}, 60000);

afterAll(async () => {
  await runtime.db?.$disconnect();
  if (path.dirname(runtime.root) === path.resolve(os.tmpdir()) && path.basename(runtime.root).startsWith('shopapp-bom-repo-')) {
    await rm(runtime.root, { recursive: true, force: true });
  }
});

async function fixture() {
  const job = await runtime.db.drawingImportJob.create({ data: {
    idempotencyKey: randomUUID(), destination: 'order', business: 'STD', customerName: 'Synthetic BOM test',
    draftReference: 'BOM-REPO', intakeMode: 'ASSEMBLY', assemblyMultiplier: 2,
    pipelineVersion: 'test', mode: 'admin_beta', configJson: '{}', softBudgetUsd: 5, hardBudgetUsd: 8,
  } });
  const source = await runtime.db.drawingImportSource.create({ data: {
    jobId: job.id, sourceKind: 'drawing', originalFilename: 'assembly.pdf',
    mimeType: 'application/pdf', sizeBytes: 1, sha256: randomUUID(), storagePath: 'synthetic-not-read.pdf',
  } });
  const page = await runtime.db.drawingImportPage.create({ data: {
    jobId: job.id, sourceId: source.id, sourcePageNumber: 1, sourceFilename: 'assembly.pdf',
    contentSha256: randomUUID(), width: 612, height: 792, classification: 'assembly_drawing',
  } });
  return { jobId: job.id as string, pageId: page.id as string };
}

function row(sourcePageId: string, rowIndex: number) {
  return {
    sourcePageId, rowIndex, item: String(rowIndex), childPartNumber: `PART-${rowIndex}`,
    description: 'Original description', quantityPerParent: 2, material: '6061', revision: null,
    parentAssemblyPartNumber: 'ASSEMBLY-1', sourceRegion: [0.1, 0.2, 0.8, 0.5],
    rawCells: ['part', '2'], warnings: ['Confirm quantity'],
  };
}

describe('Drawing Import BOM persistence on real SQLite', () => {
  it('accepts an empty reconstruction without a database write', async () => {
    await expect(createDrawingImportBomRows('no-job-required', [])).resolves.toBeUndefined();
  });

  it('saves reconstructed rows for a production-order import', async () => {
    const f = await fixture();
    await createDrawingImportBomRows(f.jobId, [row(f.pageId, 1), row(f.pageId, 2)]);
    const saved = await runtime.db.drawingImportBomRow.findMany({ where: { jobId: f.jobId }, orderBy: { rowIndex: 'asc' } });
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      id: `${f.pageId}:bom-row:1`, sourcePageId: f.pageId, childPartNumber: 'PART-1', quantityPerParent: 2,
      rawCellsJson: '["part","2"]', warningsJson: '["Confirm quantity"]',
    });
  });

  it('links every reconstructed BOM edge to the matching persisted row without shifting row identity', async () => {
    const f = await fixture();
    const span = (text: string, x1: number, x2: number, y1: number, y2: number, readingOrder: number) => ({
      pageId: f.pageId, text, region: [x1, y1, x2, y2] as [number, number, number, number], readingOrder,
    });
    const reconstructed = reconstructBomTable(f.pageId, [
      span('PART NO', 0.1, 0.3, 0.1, 0.12, 1), span('QTY', 0.7, 0.8, 0.1, 0.12, 2),
      span('PART-A', 0.1, 0.3, 0.18, 0.20, 3), span('2', 0.7, 0.8, 0.18, 0.20, 4),
      span('PART-B', 0.1, 0.3, 0.25, 0.27, 5), span('5', 0.7, 0.8, 0.25, 0.27, 6),
    ]);
    expect(reconstructed.rows).toHaveLength(2);
    const inputs = reconstructed.rows.map((parsed) => ({
      ...row(parsed.sourcePageId, parsed.rowIndex), childPartNumber: parsed.partNumber.value,
      quantityPerParent: parsed.quantityPerParent.value,
    }));
    await createDrawingImportBomRows(f.jobId, inputs);
    // Recovery repeats persistence before finalization and must retain the same IDs.
    await createDrawingImportBomRows(f.jobId, inputs);
    await replaceDrawingImportBomEdges(reconstructed.rows.map((parsed) => ({
      bomRowId: parsed.id, parentPageId: f.pageId, childPageId: f.pageId,
      quantityPerParent: parsed.quantityPerParent.value, status: 'matched', warnings: [],
    })));
    const saved = await runtime.db.drawingImportBomRow.findMany({
      where: { jobId: f.jobId }, orderBy: { rowIndex: 'asc' }, include: { edge: true },
    });
    expect(saved.map((entry: { childPartNumber: string; edge: { quantityPerParent: number } }) => ({
      part: entry.childPartNumber, edgeQuantity: entry.edge.quantityPerParent,
    }))).toEqual([{ part: 'PART-A', edgeQuantity: 2 }, { part: 'PART-B', edgeQuantity: 5 }]);
  });

  it('ignores duplicate batch rows and retries while preserving existing row IDs, values and edges', async () => {
    const f = await fixture();
    const first = row(f.pageId, 1);
    await createDrawingImportBomRows(f.jobId, [first, { ...first, quantityPerParent: 99 }]);
    await replaceDrawingImportBomEdges([{
      bomRowId: `${f.pageId}:bom-row:1`, parentPageId: f.pageId, childPageId: f.pageId,
      quantityPerParent: 2, status: 'matched', warnings: [],
    }]);
    const before = await runtime.db.drawingImportBomRow.findUniqueOrThrow({
      where: { id: `${f.pageId}:bom-row:1` }, include: { edge: true },
    });
    await createDrawingImportBomRows(f.jobId, [{ ...first, description: 'Retry changed text', quantityPerParent: 99 }, row(f.pageId, 2)]);
    const after = await runtime.db.drawingImportBomRow.findUniqueOrThrow({
      where: { id: `${f.pageId}:bom-row:1` }, include: { edge: true },
    });
    expect(after).toEqual(before);
    expect(await runtime.db.drawingImportBomRow.count({ where: { jobId: f.jobId } })).toBe(2);
  });

  it('matches a pre-existing row by its page/index key even when its ID differs', async () => {
    const f = await fixture();
    const existing = await runtime.db.drawingImportBomRow.create({ data: {
      id: randomUUID(), jobId: f.jobId, sourcePageId: f.pageId, rowIndex: 1,
      quantityPerParent: 7, sourceRegionJson: 'null', rawCellsJson: '[]',
    } });
    await createDrawingImportBomRows(f.jobId, [row(f.pageId, 1)]);
    expect(await runtime.db.drawingImportBomRow.findMany({ where: { jobId: f.jobId } })).toEqual([existing]);
  });

  it('rolls back every new row if a later row cannot be saved', async () => {
    const f = await fixture();
    await expect(createDrawingImportBomRows(f.jobId, [row(f.pageId, 1), row('missing-source-page', 2)])).rejects.toThrow();
    expect(await runtime.db.drawingImportBomRow.count({ where: { jobId: f.jobId } })).toBe(0);
  });
});
