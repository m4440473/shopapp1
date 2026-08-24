import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getShopFloorDisplayOptions, updateShopFloorDisplayOptions } from '@/modules/shop-floor/shop-floor.service';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json({ options: await getShopFloorDisplayOptions() });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const result = await updateShopFloorDisplayOptions(await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, options: result.data });
}
