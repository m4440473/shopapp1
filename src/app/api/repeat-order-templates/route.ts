import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import {
  RepeatOrderTemplateListQuery,
} from '@/modules/repeat-orders/repeat-orders.schema';
import { listRepeatOrderTemplateSummaries } from '@/modules/repeat-orders/repeat-orders.service';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!canAccessAdmin(session.user as any)) return new NextResponse('Forbidden', { status: 403 });

  const url = new URL(req.url);
  const parsed = RepeatOrderTemplateListQuery.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await listRepeatOrderTemplateSummaries(parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
