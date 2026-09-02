import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getCustomerPartHistoryDetail } from '@/modules/customer-parts/customer-parts.service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourcePartId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, sourcePartId } = await params;
  const result = await getCustomerPartHistoryDetail(id, sourcePartId);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.data });
}
