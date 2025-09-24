import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session as any).user?.role as string | undefined;
  if (!canAccessAdmin(role)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = params;
  const json = await req.json().catch(() => null);
  const rawMachinistId =
    typeof json?.machinistId === 'string' ? json.machinistId.trim() : undefined;
  const machinistId = rawMachinistId ? rawMachinistId : null;

  const order = await prisma.order.update({
    where: { id },
    data: { assignedMachinistId: machinistId },
    select: {
      id: true,
      assignedMachinistId: true,
      assignedMachinist: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ ok: true, item: order });
}
