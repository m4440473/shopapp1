import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { assignWorkerToPart, listPartWorkers } from '@/modules/orders/orders.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id, partId } = await params;
  const result = await listPartWorkers(id, partId);
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
  if (!canAccessAdmin((session as any).user)) return new NextResponse('Forbidden', { status: 403 });

  const { id, partId } = await params;
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const assignmentType = typeof body?.assignmentType === 'string' ? body.assignmentType.trim() : undefined;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }

  const result = await assignWorkerToPart({
    orderId: id,
    partId,
    userId,
    assignedById: (session.user as any)?.id as string | undefined,
    assignmentType,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
