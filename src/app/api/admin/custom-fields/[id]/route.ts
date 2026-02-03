import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { CustomFieldPatch } from '@/lib/zod';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const { id } = await params;
  const body = await req.json();
  const parsed = CustomFieldPatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const data = parsed.data;
  const options = data.options;
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.customField.update({
      where: { id },
      data: {
        entityType: data.entityType,
        name: data.name,
        key: data.key,
        fieldType: data.fieldType,
        description: data.description,
        businessCode: data.businessCode,
        defaultValue: data.defaultValue !== undefined ? serializeJsonValue(data.defaultValue) : undefined,
        isRequired: data.isRequired,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (options) {
      await tx.customFieldOption.deleteMany({ where: { fieldId: updated.id } });
      if (options.length) {
        await tx.customFieldOption.createMany({
          data: options.map((option, index) => ({
            fieldId: updated.id,
            label: option.label,
            value: option.value,
            sortOrder: option.sortOrder ?? index,
            isActive: option.isActive ?? true,
          })),
        });
      }
    }

    return tx.customField.findUnique({
      where: { id: updated.id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    item: { ...item, defaultValue: parseJsonValue(item.defaultValue) },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const { id } = await params;
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({ where: { fieldId: id } }),
    prisma.customFieldOption.deleteMany({ where: { fieldId: id } }),
    prisma.customField.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
