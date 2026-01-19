import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { getBusinessOptionByCode, type BusinessName } from '@/lib/businesses';
import { storeAttachmentFile } from '@/lib/storage';
import { getAppSettings } from '@/lib/app-settings';
import { prisma } from '@/lib/prisma';
import { PartAttachmentKind } from '@/lib/zod-charges';

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

function extractString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest, { params }: { params: { partId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const part = await prisma.orderPart.findUnique({
    where: { id: partId },
    include: { order: { include: { customer: true } } },
  });
  if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file upload' }, { status: 400 });
  }

  const kindValue = extractString(form.get('kind'));
  const parsedKind = PartAttachmentKind.safeParse(kindValue || 'OTHER');
  if (!parsedKind.success) {
    return NextResponse.json({ error: 'Invalid attachment kind' }, { status: 400 });
  }

  const label = extractString(form.get('label'));

  const order = part.order;
  const businessOption = getBusinessOptionByCode(order.business);
  const businessName = (businessOption?.name ?? 'Sterling Tool and Die') as BusinessName;
  const customerName = order.customer?.name ?? 'customer';
  const orderReference = order.orderNumber;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const settings = await getAppSettings();
    const stored = await storeAttachmentFile({
      business: businessName,
      customerName,
      referenceNumber: orderReference,
      originalFilename: file.name,
      buffer,
      rootDir: settings.attachmentsDir,
    });

    const attachment = await prisma.partAttachment.create({
      data: {
        partId,
        kind: parsedKind.data,
        url: `/attachments/${stored.storagePath}`,
        storagePath: stored.storagePath,
        label: label || file.name,
        mimeType: file.type || null,
      },
    });

    return NextResponse.json({ attachment });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to store attachment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
