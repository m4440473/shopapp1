import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { PartAttachmentCreate } from '@/lib/zod-charges';

export async function POST(req: NextRequest, { params }: { params: { partId: string } }) {
  const session = await getServerSession(authOptions as any);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = (session as any).user;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const part = await prisma.orderPart.findUnique({ where: { id: partId }, select: { id: true } });
  if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PartAttachmentCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const attachment = await prisma.partAttachment.create({
    data: {
      partId,
      kind: payload.kind,
      url: payload.url ?? (payload.storagePath ? `/attachments/${payload.storagePath}` : ''),
      storagePath: payload.storagePath ?? null,
      label: payload.label ?? null,
      mimeType: payload.mimeType ?? null,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
