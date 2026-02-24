import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { authRequiredResponse, forbiddenResponse } from '@/lib/auth-api';
import { canAccessMachinist } from '@/lib/rbac';
import { completeChecklistAndAdvance } from '@/modules/orders/orders.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; partId: string; itemId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return authRequiredResponse();
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return forbiddenResponse();

  const json = await req.json().catch(() => null);
  if (!json?.confirm) {
    return NextResponse.json({ error: 'confirm=true is required' }, { status: 400 });
  }

  const { id, partId, itemId } = await params;
  const result = await completeChecklistAndAdvance({
    orderId: id,
    partId,
    checklistId: itemId,
    actorUserId: (session.user as any)?.id as string | undefined,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
