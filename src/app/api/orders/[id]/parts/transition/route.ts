import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { canAccessMachinist } from '@/lib/rbac';
import { transitionPartsDepartment } from '@/modules/orders/orders.service';

const TransitionPayload = z.object({
  fromDepartmentId: z.string().trim().min(1),
  toDepartmentId: z.string().trim().min(1),
  partIds: z.array(z.string().trim().min(1)).min(1),
  employeeName: z.string().trim().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = TransitionPayload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await transitionPartsDepartment({
    orderId: params.id,
    ...parsed.data,
    togglerId: (session.user as any)?.id as string | undefined,
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
