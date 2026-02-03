import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { PartAttachmentUpdate } from '@/modules/orders/orders.schema';
import { deleteAttachmentForPart, updateAttachmentForPart } from '@/modules/orders/orders.service';

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return { session };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ partId: string; attachmentId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId, attachmentId } = await params;
  if (!partId || !attachmentId) {
    return NextResponse.json({ error: 'Missing part or attachment id' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PartAttachmentUpdate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateAttachmentForPart({ partId, attachmentId, payload: parsed.data });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { attachment } = result.data as { attachment: unknown };
  return NextResponse.json({ attachment });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ partId: string; attachmentId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId, attachmentId } = await params;
  if (!partId || !attachmentId) {
    return NextResponse.json({ error: 'Missing part or attachment id' }, { status: 400 });
  }

  const result = await deleteAttachmentForPart(partId, attachmentId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
