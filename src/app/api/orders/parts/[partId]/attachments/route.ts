import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { PartAttachmentCreate } from '@/modules/orders/orders.schema';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function GET(req: NextRequest, { params }: { params: { partId: string } }) {
  const session = await requireSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const part = await prisma.orderPart.findUnique({ where: { id: partId }, select: { id: true } });
  if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 });

  const attachments = await prisma.partAttachment.findMany({
    where: { partId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ attachments });
}

export async function POST(req: NextRequest, { params }: { params: { partId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const part = await prisma.orderPart.findUnique({
    where: { id: partId },
    select: { id: true, orderId: true },
  });
  if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PartAttachmentCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const attachment = await prisma.partAttachment.create({
    data: {
      orderId: part.orderId,
      partId,
      kind: payload.kind,
      url: payload.url ?? null,
      storagePath: payload.storagePath ?? null,
      label: payload.label ?? null,
      mimeType: payload.mimeType ?? null,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
