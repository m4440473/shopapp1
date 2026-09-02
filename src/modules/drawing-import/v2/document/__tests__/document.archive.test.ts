import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { extractDrawingArchive, inventoryDrawingArchive } from '../document.archive';

async function archiveBuffer(build: (zip: JSZip) => void, platform?: 'DOS' | 'UNIX') {
  const zip = new JSZip();
  build(zip);
  return zip.generateAsync({ type: 'nodebuffer', platform });
}

describe('Drawing Import V2 archive foundation', () => {
  it('inventories drawings, keeps SolidWorks metadata, and assigns collision-safe identities', async () => {
    const buffer = await archiveBuffer((zip) => {
      zip.file('assembly/a/PART-100.pdf', Buffer.from('%PDF-1.4\n'));
      zip.file('assembly/b/PART-100.pdf', Buffer.from('%PDF-1.4\n'));
      zip.file('native/ASSEMBLY.SLDASM', Buffer.from('solidworks'));
      zip.file('notes/readme.txt', Buffer.from('ignored'));
    });

    const result = await extractDrawingArchive(buffer);

    expect(result.inventory).toMatchObject({ drawingCount: 2, supportingSolidWorksCount: 1, ignoredCount: 1 });
    expect(result.drawings).toHaveLength(2);
    expect(new Set(result.drawings.map((entry) => entry.id)).size).toBe(2);
    expect(result.drawings.map((entry) => entry.archivePath)).toEqual([
      'assembly/a/PART-100.pdf',
      'assembly/b/PART-100.pdf',
    ]);
    expect(result.drawings.map((entry) => entry.collisionIndex)).toEqual([0, 1]);
    expect(result.supportingSolidWorks).toHaveLength(1);
    expect(result.supportingSolidWorks[0]).toMatchObject({
      disposition: 'supporting_solidworks',
      archivePath: 'native/ASSEMBLY.SLDASM',
      mimeType: 'application/octet-stream',
      bytes: Buffer.from('solidworks'),
    });
    expect(result.supportingSolidWorks[0].contentHash).toHaveLength(64);
    expect(result.inventory.entries.find((entry) => entry.extension === '.sldasm')).toMatchObject({
      disposition: 'supporting_solidworks',
      archivePath: 'native/ASSEMBLY.SLDASM',
    });
  });

  it.each([
    ['../outside.pdf', 'unsafe relative path'],
    ['/absolute.pdf', 'absolute path'],
    ['C:/absolute.pdf', 'absolute path'],
    ['nested.zip', 'Nested archives'],
  ])('rejects unsafe archive entry %s', async (entryName, expectedMessage) => {
    const buffer = await archiveBuffer((zip) => zip.file(entryName, Buffer.from('%PDF-1.4\n')));
    await expect(inventoryDrawingArchive(buffer)).rejects.toThrow(expectedMessage);
  });

  it('rejects symbolic links from Unix archives', async () => {
    const buffer = await archiveBuffer((zip) => {
      zip.file('linked.pdf', Buffer.from('target'), { unixPermissions: 0o120777 });
    }, 'UNIX');
    await expect(inventoryDrawingArchive(buffer)).rejects.toThrow('symbolic link');
  });

  it('rejects extension and content disagreement', async () => {
    const buffer = await archiveBuffer((zip) => zip.file('looks-like-pdf.pdf', Buffer.from([0xff, 0xd8, 0xff, 0x00])));
    await expect(extractDrawingArchive(buffer)).rejects.toThrow('content does not match');
  });

  it('rejects a renamed nested archive by content signature', async () => {
    const nested = await archiveBuffer((zip) => zip.file('inside.pdf', Buffer.from('%PDF-1.4\n')));
    const buffer = await archiveBuffer((zip) => {
      zip.file('notes/harmless-looking.bin', nested);
      zip.file('drawing.pdf', Buffer.from('%PDF-1.4\n'));
    });

    await expect(extractDrawingArchive(buffer)).rejects.toThrow('Nested ZIP content');
  });

  it('applies nested-archive protection to retained SolidWorks support files', async () => {
    const nested = await archiveBuffer((zip) => zip.file('inside.txt', Buffer.from('nested')));
    const buffer = await archiveBuffer((zip) => zip.file('renamed.sldprt', nested));

    await expect(extractDrawingArchive(buffer)).rejects.toThrow('Nested ZIP content');
  });

  it('enforces the supported drawing-entry limit without counting support files', async () => {
    const buffer = await archiveBuffer((zip) => {
      for (let index = 0; index < 101; index += 1) zip.file(`drawing-${index}.pdf`, Buffer.from('%PDF-1.4\n'));
      for (let index = 0; index < 10; index += 1) zip.file(`native-${index}.sldprt`, Buffer.from('native'));
    });
    await expect(inventoryDrawingArchive(buffer)).rejects.toThrow('limit is 100');
  });
});
