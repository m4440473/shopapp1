import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { getShopFloorSummary } from '@/modules/shop-floor/shop-floor.service';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  return NextResponse.json({ summary: await getShopFloorSummary() });
}
