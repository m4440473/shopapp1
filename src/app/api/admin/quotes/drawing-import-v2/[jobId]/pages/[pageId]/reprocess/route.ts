import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { reprocessQuoteDrawingImportV2Page } from '@/modules/drawing-import/v2/drawing-import-v2.service';

export const runtime = 'nodejs';

export async function POST(_req: Request, context: { params: Promise<{ jobId: string; pageId: string }> }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { jobId, pageId } = await context.params;
    return NextResponse.json(await reprocessQuoteDrawingImportV2Page(jobId, pageId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not reprocess page.' }, { status: 400 });
  }
}
