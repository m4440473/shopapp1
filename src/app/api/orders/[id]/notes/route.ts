import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { isMachinist } from '@/lib/rbac';
import { addOrderNote } from '@/modules/orders/orders.service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role;
  if (!isMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { content, partId } = json ?? {};
  if (!content || !content.trim()) return NextResponse.json({ error: 'Empty note' }, { status: 400 });

  const result = await addOrderNote(
    params.id,
    (session.user as any).id,
    content,
    typeof partId === 'string' ? partId : null
  );
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { note } = result.data as { note: unknown };
  return NextResponse.json({ ok: true, note });
}
