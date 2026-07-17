import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessMachinist } from '@/lib/rbac';
import { startDispatchTimer } from '@/modules/time/dispatch.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessMachinist(session.user as any)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const actorUserId = String((session.user as any)?.id ?? '').trim();
  const body = await req.json().catch(() => null);
  const workerUserId = String(body?.workerUserId ?? '').trim();
  const orderId = String(body?.orderId ?? '').trim();
  const partId = String(body?.partId ?? '').trim();
  if (!actorUserId || !workerUserId || !orderId || !partId) {
    return NextResponse.json(
      { error: 'workerUserId, orderId, and partId are required.' },
      { status: 400 },
    );
  }

  const result = await startDispatchTimer({
    actorUserId,
    workerUserId,
    orderId,
    partId,
    confirmSwitch: body?.confirmSwitch === true,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
