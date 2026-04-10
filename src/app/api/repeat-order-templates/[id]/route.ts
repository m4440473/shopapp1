import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getRepeatOrderTemplate } from '@/modules/repeat-orders/repeat-orders.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const result = await getRepeatOrderTemplate(id);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
