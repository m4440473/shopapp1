import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { PartAttachmentCreate } from '@/modules/orders/orders.schema';
import { createAttachmentForPart, listAttachmentsForPart } from '@/modules/orders/orders.service';

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

  const result = await listAttachmentsForPart(partId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ attachments: result.data.attachments });
}

export async function POST(req: NextRequest, { params }: { params: { partId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = PartAttachmentCreate.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createAttachmentForPart({ partId, payload: parsed.data });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ attachment: result.data.attachment }, { status: 201 });
}
