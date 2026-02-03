import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { DocumentTemplatePatch } from '@/lib/zod';

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const { id } = await params;
  const body = await req.json();
  const parsed = DocumentTemplatePatch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const data = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.documentTemplate.findUnique({ where: { id } });
    if (!existing) return null;

    if (data.isDefault) {
      await tx.documentTemplate.updateMany({
        where: {
          documentType: data.documentType ?? existing.documentType,
          businessCode: data.businessCode ?? existing.businessCode ?? null,
        },
        data: { isDefault: false },
      });
    }

    const shouldVersion = data.layoutJson !== undefined || data.schemaVersion !== undefined;
    const nextVersion = shouldVersion ? existing.currentVersion + 1 : existing.currentVersion;
    const nextSchemaVersion = data.schemaVersion ?? existing.schemaVersion;
    const nextLayout = data.layoutJson !== undefined ? serializeJsonValue(data.layoutJson) : existing.layoutJson;

    const template = await tx.documentTemplate.update({
      where: { id },
      data: {
        name: data.name,
        documentType: data.documentType,
        description: data.description,
        businessCode: data.businessCode,
        isDefault: data.isDefault,
        isActive: data.isActive,
        schemaVersion: nextSchemaVersion,
        currentVersion: nextVersion,
        layoutJson: nextLayout,
      },
    });

    if (shouldVersion) {
      await tx.documentTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          schemaVersion: nextSchemaVersion,
          layoutJson: nextLayout,
        },
      });
    }

    return template;
  });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    item: { ...updated, layoutJson: parseJsonValue(updated.layoutJson) },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard) return guard;
  const { id } = await params;
  await prisma.documentTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
