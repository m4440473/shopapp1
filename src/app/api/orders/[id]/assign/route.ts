import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { assignMachinistToOrder } from '@/modules/orders/orders.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const rawMachinistId =
    typeof json?.machinistId === 'string' ? json.machinistId.trim() : undefined;
  const machinistId = rawMachinistId ? rawMachinistId : null;

  const result = await assignMachinistToOrder(id, machinistId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { item } = result.data as { item: unknown };
  return NextResponse.json({ ok: true, item });
}
