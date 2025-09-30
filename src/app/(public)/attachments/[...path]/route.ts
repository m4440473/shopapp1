import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { ensureAttachmentRoot } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = Array.isArray(params.path) ? params.path : [];
  if (segments.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const relativePath = segments.join('/');
  const quoteAttachment = await prisma.quoteAttachment.findFirst({
    where: { storagePath: relativePath },
    select: { mimeType: true, label: true },
  });

  const orderAttachment = quoteAttachment
    ? null
    : await prisma.attachment.findFirst({
        where: { storagePath: relativePath },
        select: { mimeType: true, label: true },
      });

  const attachment = quoteAttachment ?? orderAttachment;

  if (!attachment) {
    return new NextResponse('Not found', { status: 404 });
  }

  const root = await ensureAttachmentRoot();
  const resolved = path.resolve(root, ...segments);
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

  const headers = new Headers();
  headers.set('Content-Type', attachment.mimeType || 'application/octet-stream');
  headers.set('Content-Length', fileInfo.size.toString());
  headers.set('Cache-Control', 'private, max-age=60');
  headers.set('Content-Disposition', `inline; filename="${path.basename(resolved)}"`);

  return new NextResponse(stream, { headers });
}
