import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { logPartEvent } from '@/modules/orders/orders.service';
import { TimeEntryClosedEdit } from '@/modules/time/time.schema';
import { editClosedTimeEntry } from '@/modules/time/time.service';

export async function PATCH(req: Request, context: { params: Promise<{ entryId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const user = (session.user ?? {}) as { id?: string; role?: string; admin?: boolean };
  const userId = user.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  if (!canAccessAdmin({ role: user.role, admin: user.admin })) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { entryId } = await context.params;
  const json = await req.json().catch(() => null);
  const parsed = TimeEntryClosedEdit.safeParse({ ...(json ?? {}), entryId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await editClosedTimeEntry(userId, parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const entry = result.data.entry;
  if (entry.partId) {
    await logPartEvent({
      orderId: entry.orderId,
      partId: entry.partId,
      userId,
      type: 'TIME_ENTRY_EDITED',
      message: 'Closed interval edited by admin.',
      meta: {
        timeEntryId: entry.id,
        reason: parsed.data.reason,
        startedAt: entry.startedAt.toISOString(),
        endedAt: entry.endedAt?.toISOString() ?? null,
      },
    });
  }

  return NextResponse.json({ entry }, { status: 200 });
}
