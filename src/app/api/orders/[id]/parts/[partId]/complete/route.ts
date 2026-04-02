import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { authRequiredResponse, forbiddenResponse } from '@/lib/auth-api';
import { canAccessMachinist } from '@/lib/rbac';
import { completeOrderPart } from '@/modules/orders/orders.service';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return authRequiredResponse();

  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return forbiddenResponse();

  const { id, partId } = await params;
  const result = await completeOrderPart({
    orderId: id,
    partId,
    userId: (session.user as any)?.id as string | undefined,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
