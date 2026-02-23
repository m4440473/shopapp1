import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import {
  parseCustomerUpdatePayload,
  updateCustomerFromInput,
  buildCustomerUpdateData,
} from '@/modules/customers/customers.service';
import { canAccessAdmin } from '@/lib/rbac';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = parseCustomerUpdatePayload(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (Object.keys(buildCustomerUpdateData(payload)).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const customer = await updateCustomerFromInput(id, payload);

  return NextResponse.json({ ok: true, item: customer });
}
