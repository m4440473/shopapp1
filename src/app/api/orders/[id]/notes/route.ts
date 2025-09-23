import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { isMachinist } from '@/lib/rbac';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role;
  if (!isMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { content } = json ?? {};
  if (!content || !content.trim()) return NextResponse.json({ error: 'Empty note' }, { status: 400 });

  const note = await prisma.note.create({ data: { orderId: params.id, userId: (session.user as any).id, content: content.trim() } });
  return NextResponse.json({ ok: true, note });
}
