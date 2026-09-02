import path from 'node:path';

import JSZip from 'jszip';

import {
  DRAWING_ARCHIVE_LIMITS,
  type DrawingArchiveEntry,
  type DrawingArchiveInventory,
  type DrawingDocumentMimeType,
  type ExtractedDrawingArchiveEntry,
  type ExtractedSupportingSolidWorksEntry,
} from './document.types';
import { sha256Hex } from './document.hash';

const DRAWING_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const SOLIDWORKS_EXTENSIONS = new Set(['.sldprt', '.sldasm', '.slddrw']);
const NESTED_ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.tar', '.tgz', '.gz', '.bz2', '.xz']);
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMLINK = 0o120000;

type ZipEntryWithSizes = JSZip.JSZipObject & {
  _data?: { compressedSize?: number; uncompressedSize?: number };
};

function originalArchivePath(entry: JSZip.JSZipObject) {
  return (entry.unsafeOriginalName ?? entry.name).replace(/\\/g, '/');
}

function assertSafeArchivePath(archivePath: string) {
  if (
    !archivePath
    || archivePath.startsWith('/')
    || archivePath.startsWith('//')
    || /^[a-zA-Z]:\//.test(archivePath)
  ) {
    throw new Error(`Archive entry uses an absolute path: ${archivePath || '(empty)'}.`);
  }
  const segments = archivePath.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Archive entry uses an unsafe relative path: ${archivePath}.`);
  }
}

function assertNotSymlink(entry: JSZip.JSZipObject, archivePath: string) {
  const permissions = typeof entry.unixPermissions === 'string'
    ? Number.parseInt(entry.unixPermissions, 8)
    : entry.unixPermissions;
  if (typeof permissions === 'number' && (permissions & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK) {
    throw new Error(`Archive entry is a symbolic link: ${archivePath}.`);
  }
}

function declaredSizes(entry: ZipEntryWithSizes) {
  return {
    compressed: Number(entry._data?.compressedSize ?? 0),
    uncompressed: Number(entry._data?.uncompressedSize ?? 0),
  };
}

function mimeTypeFromMagic(bytes: Buffer): DrawingDocumentMimeType | null {
  if (bytes.subarray(0, 1_024).includes(Buffer.from('%PDF-'))) return 'application/pdf';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

function nestedArchiveTypeFromMagic(bytes: Buffer): string | null {
  if (
    bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (
      (bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08)
    )
  ) return 'ZIP';
  if (bytes.subarray(0, 7).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]))) return 'RAR';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]))) return 'RAR';
  if (bytes.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))) return '7Z';
  if (bytes.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))) return 'GZIP';
  if (bytes.subarray(0, 3).equals(Buffer.from('BZh'))) return 'BZIP2';
  if (bytes.subarray(0, 6).equals(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))) return 'XZ';
  if (bytes.length >= 262 && bytes.subarray(257, 262).equals(Buffer.from('ustar'))) return 'TAR';
  return null;
}

function expectedMimeType(extension: string): DrawingDocumentMimeType | null {
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  return null;
}

async function loadArchive(buffer: Buffer) {
  if (buffer.length > DRAWING_ARCHIVE_LIMITS.maxArchiveBytes) {
    throw new Error('Drawing ZIP exceeds the 100 MB upload limit.');
  }
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('Drawing archive does not have a valid ZIP signature.');
  }
  return JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
}

export async function inventoryDrawingArchive(buffer: Buffer): Promise<DrawingArchiveInventory> {
  const archiveHash = sha256Hex(buffer);
  const archive = await loadArchive(buffer);
  const sourceEntries = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'));
  if (sourceEntries.length > DRAWING_ARCHIVE_LIMITS.maxScannedEntries) {
    throw new Error(`Drawing ZIP contains more than ${DRAWING_ARCHIVE_LIMITS.maxScannedEntries} entries.`);
  }

  const filenameCounts = new Map<string, number>();
  const entries: DrawingArchiveEntry[] = sourceEntries.map((entry, index) => {
    const archivePath = originalArchivePath(entry);
    assertSafeArchivePath(archivePath);
    assertNotSymlink(entry, archivePath);
    const filename = path.posix.basename(archivePath);
    const extension = path.posix.extname(filename).toLowerCase();
    if (NESTED_ARCHIVE_EXTENSIONS.has(extension)) {
      throw new Error(`Nested archives are not allowed: ${archivePath}.`);
    }
    const sizes = declaredSizes(entry as ZipEntryWithSizes);
    if (sizes.uncompressed > DRAWING_ARCHIVE_LIMITS.maxEntryBytes) {
      throw new Error(`${filename} exceeds the 20 MB per-entry limit.`);
    }
    if (
      sizes.compressed > 0
      && sizes.uncompressed > 0
      && sizes.uncompressed / sizes.compressed > DRAWING_ARCHIVE_LIMITS.maxCompressionRatio
    ) {
      throw new Error(`${filename} has an unsafe compression ratio.`);
    }
    const collisionKey = filename.toLowerCase();
    const collisionIndex = filenameCounts.get(collisionKey) ?? 0;
    filenameCounts.set(collisionKey, collisionIndex + 1);
    const disposition = DRAWING_EXTENSIONS.has(extension)
      ? 'drawing'
      : SOLIDWORKS_EXTENSIONS.has(extension)
        ? 'supporting_solidworks'
        : 'ignored';
    return {
      id: `archive-entry-${sha256Hex(`${archiveHash}\0${index}\0${archivePath}`).slice(0, 32)}`,
      archivePath,
      filename,
      extension,
      disposition,
      declaredCompressedBytes: sizes.compressed,
      declaredUncompressedBytes: sizes.uncompressed,
      unixPermissions: typeof entry.unixPermissions === 'number' ? entry.unixPermissions : null,
      collisionIndex,
    };
  });

  const drawingCount = entries.filter((entry) => entry.disposition === 'drawing').length;
  if (drawingCount > DRAWING_ARCHIVE_LIMITS.maxDrawingEntries) {
    throw new Error(`Drawing ZIP contains ${drawingCount} supported drawings; the limit is ${DRAWING_ARCHIVE_LIMITS.maxDrawingEntries}.`);
  }
  const declaredExpandedBytes = entries
    .reduce((total, entry) => total + entry.declaredUncompressedBytes, 0);
  if (declaredExpandedBytes > DRAWING_ARCHIVE_LIMITS.maxExpandedArchiveBytes) {
    throw new Error('Expanded archive content exceeds the 100 MB ZIP limit.');
  }

  return {
    archiveHash,
    entries,
    drawingCount,
    supportingSolidWorksCount: entries.filter((entry) => entry.disposition === 'supporting_solidworks').length,
    ignoredCount: entries.filter((entry) => entry.disposition === 'ignored').length,
  };
}

export async function extractDrawingArchive(buffer: Buffer): Promise<{
  inventory: DrawingArchiveInventory;
  drawings: ExtractedDrawingArchiveEntry[];
  supportingSolidWorks: ExtractedSupportingSolidWorksEntry[];
}> {
  const inventory = await inventoryDrawingArchive(buffer);
  const archive = await loadArchive(buffer);
  const entriesByPath = new Map(
    Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .map((entry) => [originalArchivePath(entry), entry]),
  );
  const drawings: ExtractedDrawingArchiveEntry[] = [];
  const supportingSolidWorks: ExtractedSupportingSolidWorksEntry[] = [];
  let expandedArchiveBytes = 0;
  let expandedDrawingBytes = 0;
  for (const metadata of inventory.entries) {
    const entry = entriesByPath.get(metadata.archivePath);
    if (!entry) throw new Error(`Archive entry disappeared during extraction: ${metadata.archivePath}.`);
    const bytes = await entry.async('nodebuffer');
    if (bytes.length > DRAWING_ARCHIVE_LIMITS.maxEntryBytes) {
      throw new Error(`${metadata.filename} exceeds the 20 MB per-entry limit.`);
    }
    expandedArchiveBytes += bytes.length;
    if (expandedArchiveBytes > DRAWING_ARCHIVE_LIMITS.maxExpandedArchiveBytes) {
      throw new Error('Expanded archive content exceeds the 100 MB ZIP limit.');
    }
    const nestedArchiveType = nestedArchiveTypeFromMagic(bytes);
    if (nestedArchiveType) {
      throw new Error(`Nested ${nestedArchiveType} content is not allowed: ${metadata.archivePath}.`);
    }
    if (metadata.disposition === 'supporting_solidworks') {
      supportingSolidWorks.push({
        ...metadata,
        disposition: 'supporting_solidworks',
        mimeType: 'application/octet-stream',
        bytes,
        contentHash: sha256Hex(bytes),
      });
      continue;
    }
    if (metadata.disposition !== 'drawing') continue;
    expandedDrawingBytes += bytes.length;
    if (expandedDrawingBytes > DRAWING_ARCHIVE_LIMITS.maxExpandedDrawingBytes) {
      throw new Error('Expanded drawings exceed the 100 MB ZIP limit.');
    }
    const actualMimeType = mimeTypeFromMagic(bytes);
    const expected = expectedMimeType(metadata.extension);
    if (!actualMimeType || actualMimeType !== expected) {
      throw new Error(`${metadata.filename} content does not match its file extension.`);
    }
    drawings.push({
      ...metadata,
      disposition: 'drawing',
      mimeType: actualMimeType,
      bytes,
      contentHash: sha256Hex(bytes),
    });
  }
  return { inventory, drawings, supportingSolidWorks };
}
