import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { closeDispatchTimer } from '@/modules/time/dispatch.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const actorUserId = String((session.user as any)?.id ?? '').trim();
  const body = await req.json().catch(() => null);
  const workerUserId = String(body?.workerUserId ?? '').trim();
  const entryId = String(body?.entryId ?? '').trim();
  const reason = String(body?.reason ?? '').trim();
  if (!workerUserId || !entryId || reason.length < 5) {
    return NextResponse.json(
      { error: 'workerUserId, entryId, and a reason of at least five characters are required.' },
      { status: 400 },
    );
  }

  const result = await closeDispatchTimer({
    actorUserId,
    workerUserId,
    entryId,
    action: 'ADMIN_CLOSE',
    reason,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
