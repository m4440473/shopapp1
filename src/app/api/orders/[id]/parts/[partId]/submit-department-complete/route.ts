import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { authRequiredResponse, forbiddenResponse } from '@/lib/auth-api';
import { canAccessMachinist } from '@/lib/rbac';
import { submitDepartmentComplete } from '@/modules/orders/orders.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return authRequiredResponse();

  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return forbiddenResponse();

  const { id, partId } = await params;
  const body = await req.json().catch(() => null);
  const additionalSecondsRaw = body?.additionalSeconds;
  const additionalSeconds =
    typeof additionalSecondsRaw === 'number'
      ? additionalSecondsRaw
      : Number.isFinite(Number(additionalSecondsRaw))
        ? Number(additionalSecondsRaw)
        : undefined;
  const adjustmentNote = typeof body?.adjustmentNote === 'string' ? body.adjustmentNote : undefined;

  const result = await submitDepartmentComplete({
    orderId: id,
    partId,
    userId: (session.user as any)?.id as string | undefined,
    additionalSeconds,
    adjustmentNote,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
