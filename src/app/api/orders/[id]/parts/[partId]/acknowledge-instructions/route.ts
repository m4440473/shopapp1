import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessMachinist } from '@/lib/rbac';
import { unlockKioskByWorkerPin } from '@/modules/kiosk/kiosk.service';
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
  const requestedWorkerId = typeof body?.workerId === 'string' ? body.workerId.trim() : '';
  const workerPin = typeof body?.pin === 'string' ? body.pin.trim() : '';
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required.' }, { status: 400 });
  }

  let acknowledgementUserId = (session.user as any)?.id as string;
  if (requestedWorkerId) {
    if (!workerPin) {
      return NextResponse.json({ error: 'pin is required when workerId is provided.' }, { status: 400 });
    }
    const unlockResult = await unlockKioskByWorkerPin({
      userId: requestedWorkerId,
      pin: workerPin,
    });
    if (unlockResult.ok === false) {
      return NextResponse.json({ error: unlockResult.error }, { status: unlockResult.status });
    }
    acknowledgementUserId = requestedWorkerId;
  }

  const result = await acknowledgePartInstructions({
    orderId: id,
    partId,
    departmentId,
    userId: acknowledgementUserId,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
