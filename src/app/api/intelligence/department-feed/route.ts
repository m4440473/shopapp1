import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { getOrderDepartmentFeed } from '@/modules/orders/orders.service';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json({ error: 'Missing departmentId' }, { status: 400 });
  }

  const result = await getOrderDepartmentFeed(departmentId);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
