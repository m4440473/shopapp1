import { NextResponse } from 'next/server';
import { getKioskSessionUserId } from '@/app/api/kiosk/_lib';
import { KioskPartsSearchInput } from '@/modules/kiosk/kiosk.schema';
import { searchKioskParts } from '@/modules/kiosk/kiosk.service';

export async function GET(req: Request) {
  const userId = getKioskSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Kiosk locked.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = KioskPartsSearchInput.safeParse({
    departmentId: searchParams.get('departmentId') ?? '',
    q: searchParams.get('q') ?? '',
    take: searchParams.get('take') ?? 30,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await searchKioskParts({
    userId,
    departmentId: parsed.data.departmentId,
    query: parsed.data.q,
    take: parsed.data.take,
  });
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
