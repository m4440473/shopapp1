import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { removeWorkerFromPart } from '@/modules/orders/orders.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string; assignmentId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin((session as any).user)) return new NextResponse('Forbidden', { status: 403 });

  const { id, partId, assignmentId } = await params;
  const result = await removeWorkerFromPart({
    orderId: id,
    partId,
    assignmentId,
    removedById: (session.user as any)?.id as string | undefined,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
