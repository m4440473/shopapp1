import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { DocumentTemplateUpsert } from '@/lib/zod';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

function serializeJsonValue(value: unknown) {
  return JSON.stringify(value);
}

function parseJsonValue(value: string) {
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
  const documentType = searchParams.get('documentType') || undefined;
  const businessCode = searchParams.get('businessCode') || undefined;
  const isActiveParam = searchParams.get('isActive');
  const isActive = isActiveParam === null ? undefined : isActiveParam === 'true';

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (documentType) where.documentType = documentType;
  if (businessCode) where.businessCode = businessCode;
  if (isActive !== undefined) where.isActive = isActive;

  const items = await prisma.documentTemplate.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = items.length > take ? (items[take] as any).id : null;
  if (nextCursor) items.pop();

  const normalized = items.map((item) => ({
    ...item,
    layoutJson: parseJsonValue(item.layoutJson),
  }));
  return NextResponse.json({ items: normalized, nextCursor });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const body = await req.json();
  const parsed = DocumentTemplateUpsert.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const data = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.documentTemplate.updateMany({
        where: {
          documentType: data.documentType,
          businessCode: data.businessCode ?? null,
        },
        data: { isDefault: false },
      });
    }

    const template = await tx.documentTemplate.create({
      data: {
        name: data.name,
        documentType: data.documentType,
        description: data.description,
        businessCode: data.businessCode,
        isDefault: data.isDefault,
        isActive: data.isActive,
        schemaVersion: data.schemaVersion,
        currentVersion: 1,
        layoutJson: serializeJsonValue(data.layoutJson),
      },
    });

    await tx.documentTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        schemaVersion: data.schemaVersion,
        layoutJson: serializeJsonValue(data.layoutJson),
      },
    });

    return template;
  });

  return NextResponse.json({
    ok: true,
    item: { ...created, layoutJson: parseJsonValue(created.layoutJson) },
  });
}
