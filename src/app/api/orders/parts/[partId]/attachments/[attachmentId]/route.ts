import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { PartAttachmentUpdate } from '@/lib/zod-charges';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { partId: string; attachmentId: string } }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId, attachmentId } = params;
  if (!partId || !attachmentId) {
    return NextResponse.json({ error: 'Missing part or attachment id' }, { status: 400 });
  }

  const attachment = await prisma.partAttachment.findFirst({
    where: { id: attachmentId, partId },
    select: { id: true },
  });
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PartAttachmentUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const data: Record<string, any> = {};
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.url !== undefined) data.url = payload.url ?? null;
  if (payload.storagePath !== undefined) data.storagePath = payload.storagePath ?? null;
  if (payload.label !== undefined) data.label = payload.label ?? null;
  if (payload.mimeType !== undefined) data.mimeType = payload.mimeType ?? null;

  const updated = await prisma.partAttachment.update({
    where: { id: attachmentId },
    data,
  });

  return NextResponse.json({ attachment: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { partId: string; attachmentId: string } }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId, attachmentId } = params;
  if (!partId || !attachmentId) {
    return NextResponse.json({ error: 'Missing part or attachment id' }, { status: 400 });
  }

  const attachment = await prisma.partAttachment.findFirst({
    where: { id: attachmentId, partId },
    select: { id: true },
  });
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  await prisma.partAttachment.delete({ where: { id: attachmentId } });

  return NextResponse.json({ ok: true });
}
