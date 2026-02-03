import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessMachinist } from '@/lib/rbac';
import { listChecklistForOrder, toggleChecklistItem } from '@/modules/orders/orders.service';

async function requireAuth() {
  const session = await getServerAuthSession();
  if (!session) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const json = await req.json().catch(() => null);
    const { checklistId, chargeId, addonId, partId, departmentId, checked } = json ?? {};
    if (!checklistId && !chargeId && !addonId) {
      return NextResponse.json({ error: 'Missing checklistId' }, { status: 400 });
    }
    if (departmentId && !partId) {
      return NextResponse.json(
        { error: 'Department checklist items require a partId.' },
        { status: 400 }
      );
    }
    if (typeof checked !== 'boolean') return NextResponse.json({ error: 'Missing checked state' }, { status: 400 });

    const user = session.user as any;
    const togglerId = user?.id as string | undefined;
    const togglerName =
      (typeof user?.name === 'string' && user.name.trim()) ||
      (typeof user?.email === 'string' && user.email.trim()) ||
      (typeof user?.id === 'string' && user.id.trim()) ||
      undefined;

    const orderId = id;
    const result = await toggleChecklistItem({
      orderId,
      checklistId,
      chargeId,
      addonId,
      partId,
      checked,
      employeeName: togglerName,
      togglerId,
    });

    if (result.ok === false) {
      if (result.status >= 500) {
        console.error('Checklist toggle failed', { orderId, error: result.error });
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Checklist toggle error', error);
    return NextResponse.json({ error: 'Failed to toggle checklist item.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  const result = await listChecklistForOrder(id);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
