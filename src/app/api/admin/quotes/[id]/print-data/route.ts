import 'server-only';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { getActiveDocumentTemplate, listDocumentTemplates } from '@/lib/document-templates';
import { findQuoteById } from '@/modules/quotes/quotes.service';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return { session, user };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const quote = await findQuoteById(params.id);
  if (!quote) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [activeTemplate, templates] = await Promise.all([
    getActiveDocumentTemplate({
      documentType: 'QUOTE',
      businessCode: quote.business,
    }),
    listDocumentTemplates({
      documentType: 'QUOTE',
      businessCode: quote.business,
      activeOnly: true,
    }),
  ]);

  return NextResponse.json({
    quote,
    templates,
    activeTemplate,
  });
}
