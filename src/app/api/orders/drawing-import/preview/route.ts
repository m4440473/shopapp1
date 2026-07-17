import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import { NextRequest, NextResponse } from 'next/server';

import { getAppSettings } from '@/lib/app-settings';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { resolveDraftDrawingPreview } from '@/modules/drawing-import/drawing-import.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const storagePath = req.nextUrl.searchParams.get('path') ?? '';
  try {
    const settings = await getAppSettings();
    const drawing = await resolveDraftDrawingPreview(storagePath, settings.attachmentsDir);
    const stream = Readable.toWeb(createReadStream(drawing.absolutePath)) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': drawing.mimeType,
        'Content-Length': drawing.size.toString(),
        'Content-Disposition': `inline; filename="${drawing.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Drawing not found', { status: 404 });
  }
}
