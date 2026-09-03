import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { getSystemHealthSnapshot } from '@/modules/system-health/system-health.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  return NextResponse.json(await getSystemHealthSnapshot());
}
