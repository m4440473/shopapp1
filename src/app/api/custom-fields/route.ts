import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { prisma } from '@/lib/prisma';
import { parseCustomFieldValue } from '@/lib/custom-field-values';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || undefined;
  const businessCode = searchParams.get('businessCode') || undefined;
  const isActiveParam = searchParams.get('isActive');
  const isActive = isActiveParam === null ? undefined : isActiveParam === 'true';

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (businessCode) {
    where.OR = [{ businessCode }, { businessCode: null }];
  }
  if (isActive !== undefined) where.isActive = isActive;

  const items = await prisma.customField.findMany({
    where,
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const normalized = items.map((item) => ({
    ...item,
    defaultValue: parseCustomFieldValue(item.defaultValue),
  }));

  return NextResponse.json({ items: normalized });
}
