import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { NextRequest, NextResponse } from 'next/server';

import { ensureAttachmentRoot } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export async function GET(_req: NextRequest) {
  const { getAppSettings } = await import('@/lib/app-settings');
  const settings = await getAppSettings();
  if (!settings.logoPath) {
    return new NextResponse('Not found', { status: 404 });
  }

  const root = await ensureAttachmentRoot(settings.attachmentsDir);
  const resolved = path.resolve(root, settings.logoPath);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolved.startsWith(normalizedRoot)) {
    return new NextResponse('Not found', { status: 404 });
  }

  let fileInfo;
  try {
    fileInfo = await stat(resolved);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!fileInfo.isFile()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const nodeStream = createReadStream(resolved);
  const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  const ext = path.extname(resolved).toLowerCase();

  const headers = new Headers();
  headers.set('Content-Type', MIME_BY_EXTENSION[ext] ?? 'application/octet-stream');
  headers.set('Content-Length', fileInfo.size.toString());
  headers.set('Cache-Control', 'private, max-age=60');
  headers.set('Content-Disposition', `inline; filename="${path.basename(resolved)}"`);

  return new NextResponse(stream, { headers });
}
