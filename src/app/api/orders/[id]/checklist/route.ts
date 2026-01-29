import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessMachinist } from '@/lib/rbac';
import { listChecklistForOrder, toggleChecklistItem } from '@/modules/orders/orders.service';

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const role = (session.user as any)?.role as string | undefined;
  if (!canAccessMachinist(role)) return new NextResponse('Forbidden', { status: 403 });

  const json = await req.json().catch(() => null);
  const { checklistId, chargeId, addonId, partId, checked } = json ?? {};
  const employeeName = typeof json?.employeeName === 'string' ? json.employeeName.trim() : '';
  if (!checklistId && !chargeId && !addonId) {
    return NextResponse.json({ error: 'Missing checklistId' }, { status: 400 });
  }
  if (typeof checked !== 'boolean') return NextResponse.json({ error: 'Missing checked state' }, { status: 400 });
  if (!employeeName) return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });

  const orderId = params.id;
  const result = await toggleChecklistItem({
    orderId,
    checklistId,
    chargeId,
    addonId,
    partId,
    checked,
    employeeName,
    togglerId: (session.user as any)?.id as string | undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const result = await listChecklistForOrder(params.id);
  return NextResponse.json(result.data);
}
