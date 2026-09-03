import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { CustomerPartHistoryQuery } from '@/modules/customer-parts/customer-parts.schema';
import { listCustomerPartHistory } from '@/modules/customer-parts/customer-parts.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = CustomerPartHistoryQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const result = await listCustomerPartHistory(id, parsed.data);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
