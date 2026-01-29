import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { getAppSettings } from '@/lib/app-settings';
import { updateQuoteApproval } from '@/modules/quotes/quotes.repo';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return { session };
}

const AttachmentSchema = z
  .object({
    url: z.string().trim().max(500).optional(),
    storagePath: z.string().trim().max(500).optional(),
    label: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(200).optional().nullable(),
  })
  .refine((value) => Boolean(value.url?.length || value.storagePath?.length), {
    message: 'Attachment requires a URL or storage path',
    path: ['storagePath'],
  });

const BodySchema = z.object({
  received: z.boolean(),
  attachment: AttachmentSchema.optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { received, attachment } = parsed.data;

  const settings = await getAppSettings();

  const result = await updateQuoteApproval({
    quoteId: params.id,
    received,
    attachment,
    requireAttachment: settings.requirePOForQuoteApproval,
  });

  if (result.status === 404) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (result.status === 400) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    approval: result.approval,
    metadata: result.metadata,
    attachments: result.attachments,
  });
}
