import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { assignMachinistToOrder } from '@/modules/orders/orders.service';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  const json = await req.json().catch(() => null);
  const rawMachinistId =
    typeof json?.machinistId === 'string' ? json.machinistId.trim() : undefined;
  const machinistId = rawMachinistId ? rawMachinistId : null;

  const result = await assignMachinistToOrder(id, machinistId);
  return NextResponse.json({ ok: true, item: result.data.item });
}
