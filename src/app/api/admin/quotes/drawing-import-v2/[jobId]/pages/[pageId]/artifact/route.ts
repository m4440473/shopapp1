import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { resolveQuoteDrawingImportV2Artifact } from '@/modules/drawing-import/v2/drawing-import-v2.service';

export const runtime = 'nodejs';
const kinds = new Set(['canonical', 'preview', 'source', 'crop']);

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string; pageId: string }> }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });
  try {
    const { jobId, pageId } = await context.params;
    const kind = req.nextUrl.searchParams.get('kind') ?? '';
    if (!kinds.has(kind)) throw new Error('Invalid artifact type.');
    const artifact = await resolveQuoteDrawingImportV2Artifact({
      jobId,
      pageId,
      kind: kind as 'canonical' | 'preview' | 'source' | 'crop',
      cropStoragePath: req.nextUrl.searchParams.get('path'),
    });
    return new NextResponse(new Uint8Array(artifact.bytes), {
      headers: {
        'Content-Type': artifact.mimeType,
        'Content-Disposition': `inline; filename="${artifact.filename.replace(/["\r\n]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : 'Artifact not found.', { status: 404 });
  }
}
