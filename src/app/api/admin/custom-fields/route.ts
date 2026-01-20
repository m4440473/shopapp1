import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { CustomFieldUpsert } from '@/lib/zod';

const prisma = new PrismaClient();

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

function serializeJsonValue(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function parseJsonValue(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || undefined;
  const cursor = searchParams.get('cursor');
  const take = Number(searchParams.get('take') || '20');
  const entityType = searchParams.get('entityType') || undefined;
  const businessCode = searchParams.get('businessCode') || undefined;
  const isActiveParam = searchParams.get('isActive');
  const isActive = isActiveParam === null ? undefined : isActiveParam === 'true';

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { key: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (entityType) where.entityType = entityType;
  if (businessCode) where.businessCode = businessCode;
  if (isActive !== undefined) where.isActive = isActive;

  const items = await prisma.customField.findMany({
    where,
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();

  const normalized = items.map((item) => ({
    ...item,
    defaultValue: parseJsonValue(item.defaultValue),
  }));
  return NextResponse.json({ items: normalized, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const body = await req.json();
  const parsed = CustomFieldUpsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const data = parsed.data;
  const item = await prisma.customField.create({
    data: {
      entityType: data.entityType,
      name: data.name,
      key: data.key,
      fieldType: data.fieldType,
      description: data.description,
      businessCode: data.businessCode,
      defaultValue: serializeJsonValue(data.defaultValue),
      isRequired: data.isRequired,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      options: data.options?.length
        ? {
            create: data.options.map((option, index) => ({
              label: option.label,
              value: option.value,
              sortOrder: option.sortOrder ?? index,
              isActive: option.isActive ?? true,
            })),
          }
        : undefined,
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json({
    ok: true,
    item: { ...item, defaultValue: parseJsonValue(item.defaultValue) },
  });
}
