import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessMachinist } from '@/lib/rbac';
import { previewChecklistComplete } from '@/modules/orders/orders.service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; partId: string; itemId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const { id, partId, itemId } = await params;
  const result = await previewChecklistComplete({ orderId: id, partId, checklistId: itemId });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
