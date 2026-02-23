import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin, canAccessViewer, isMachinist } from '@/lib/rbac';
import {
  createCustomerFromInput,
  listCustomersForAdmin,
  parseCustomerCreatePayload,
} from '@/modules/customers/customers.service';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as any;
  const canView = canAccessAdmin(user) || isMachinist(user) || canAccessViewer(user);
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const take = parseInt(searchParams.get('take') || '100', 10);
  const customers = await listCustomersForAdmin(take);
  return NextResponse.json({ items: customers });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseCustomerCreatePayload(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const customer = await createCustomerFromInput(parsed.data);
  return NextResponse.json({ ok: true, item: customer });
}
