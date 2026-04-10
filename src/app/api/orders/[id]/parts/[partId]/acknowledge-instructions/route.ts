import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessMachinist } from '@/lib/rbac';
import { acknowledgePartInstructions, getPartInstructionStatus } from '@/modules/orders/orders.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessMachinist((session.user as any)?.role as string | undefined)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id, partId } = await params;
  const result = await getPartInstructionStatus({
    orderId: id,
    partId,
    userId: (session.user as any)?.id as string | undefined,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessMachinist((session.user as any)?.role as string | undefined)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id, partId } = await params;
  const body = await req.json().catch(() => null);
  const departmentId = typeof body?.departmentId === 'string' ? body.departmentId.trim() : '';
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required.' }, { status: 400 });
  }

  const result = await acknowledgePartInstructions({
    orderId: id,
    partId,
    departmentId,
    userId: (session.user as any)?.id as string,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
