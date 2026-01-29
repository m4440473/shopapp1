import 'server-only';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { getActiveDocumentTemplate, listDocumentTemplates } from '@/lib/document-templates';
import { getOrderPrintData } from '@/modules/orders/orders.service';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return { session };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireSession();
  if (guard instanceof NextResponse) return guard;

  const result = await getOrderPrintData(params.id);
  if (result.ok === false) {
    return new NextResponse('Not found', { status: result.status });
  }
  const { order, addons } = result.data as { order: any; addons: any };

  const [activeTemplate, templates] = await Promise.all([
    getActiveDocumentTemplate({
      documentType: 'ORDER_PRINT',
      businessCode: order.business,
    }),
    listDocumentTemplates({
      documentType: 'ORDER_PRINT',
      businessCode: order.business,
      activeOnly: true,
    }),
  ]);

  return NextResponse.json({
    order,
    addons,
    templates,
    activeTemplate,
  });
}
