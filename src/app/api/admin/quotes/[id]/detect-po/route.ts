import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getAppSettings } from '@/lib/app-settings';
import { findQuoteForConversion } from '@/modules/quotes/quotes.service';
import {
  detectPurchaseOrderFromStoredPdfAttachments,
} from '@/modules/drawing-import/drawing-import.service';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const quote = await findQuoteForConversion(id);
  if (!quote) return new NextResponse('Not found', { status: 404 });

  const settings = await getAppSettings();
  const detected = await detectPurchaseOrderFromStoredPdfAttachments(quote.attachments ?? [], settings.attachmentsDir);
  return NextResponse.json(detected ?? { poNumber: null });
}
