import 'server-only';

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';
import { getDepartmentsOrdered } from '@/modules/orders/orders.service';
import { TimeEntryStart } from '@/modules/time/time.schema';
import { startTimeEntry } from '@/modules/time/time.service';

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const userId = (session.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = TimeEntryStart.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const departmentsResult = await getDepartmentsOrdered();
  if (departmentsResult.ok === false) {
    return NextResponse.json({ error: departmentsResult.error }, { status: departmentsResult.status });
  }
  const selectedDepartment = departmentsResult.data.items.find((department) => department.id === parsed.data.departmentId);
  if (!selectedDepartment) {
    return NextResponse.json({ error: 'Department not found.' }, { status: 400 });
  }
  if (selectedDepartment.name.trim().toLowerCase() === 'shipping') {
    return NextResponse.json({ error: 'Shipping timers are disabled.' }, { status: 400 });
  }

  const result = await startTimeEntry(userId, parsed.data);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { entry } = result.data as { entry: unknown };
  return NextResponse.json({ entry }, { status: 201 });
}
