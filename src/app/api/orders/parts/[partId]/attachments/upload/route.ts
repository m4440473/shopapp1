import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { businessNameFromCode, type BusinessName } from '@/lib/businesses';
import { getAppSettings } from '@/lib/app-settings';
import { storeAttachmentFile } from '@/lib/storage';
import { getPartUploadContext } from '@/modules/orders/orders.service';

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

export async function POST(req: NextRequest, { params }: { params: { partId: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { partId } = params;
  if (!partId) return NextResponse.json({ error: 'Missing part id' }, { status: 400 });

  const result = await getPartUploadContext(partId);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  const { part } = result.data as { part: any };

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file upload' }, { status: 400 });
  }

  const customerName = part.order.customer?.name?.trim() || 'Customer';
  const business = businessNameFromCode(part.order.business) as BusinessName;
  const orderReference = part.order.orderNumber;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const settings = await getAppSettings();
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: orderReference,
      originalFilename: file.name,
      buffer,
      rootDir: settings.attachmentsDir,
    });

    return NextResponse.json({
      storagePath: stored.storagePath,
      label: file.name,
      mimeType: file.type || null,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to store attachment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
