import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      parts: { include: { material: true } },
      checklist: { include: { checklistItem: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      attachments: true,
      assignedMachinist: true,
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item: order });
}
