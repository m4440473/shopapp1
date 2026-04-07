import { NextResponse } from 'next/server';

import { authRequiredResponse, forbiddenResponse } from '@/lib/auth-api';
import { getServerAuthSession } from '@/lib/auth-session';
import { printAnalyzerResultSchema } from '@/lib/printAnalyzer/schema';
import { prisma } from '@/lib/prisma';
import { canAccessMachinist } from '@/lib/rbac';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  const session = await getServerAuthSession();
  if (!session) return authRequiredResponse();

  const role = (session.user as { role?: string } | undefined)?.role;
  if (!canAccessMachinist(role)) return forbiddenResponse();

  const { id: orderId, partId } = await params;

  const saved = await prisma.partBomAnalysis.findUnique({
    where: { orderId_partId: { orderId, partId } },
    select: {
      resultJson: true,
      updatedAt: true,
      sourceLabel: true,
    },
  });

  if (!saved) {
    return NextResponse.json({ result: null }, { status: 200 });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(saved.resultJson) as unknown;
  } catch {
    return NextResponse.json({ result: null, warning: 'Saved BOM analysis could not be parsed.' }, { status: 200 });
  }

  const validated = printAnalyzerResultSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json({ result: null, warning: 'Saved BOM analysis is invalid and was skipped.' }, { status: 200 });
  }

  return NextResponse.json(
    {
      result: validated.data,
      updatedAt: saved.updatedAt,
      sourceLabel: saved.sourceLabel,
    },
    { status: 200 }
  );
}
