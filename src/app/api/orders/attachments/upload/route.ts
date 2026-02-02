import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { BUSINESS_NAMES, storeAttachmentFile, type BusinessName } from '@/lib/storage';
import { getAppSettings } from '@/lib/app-settings';

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = session.user as any;
  if (!canAccessAdmin(user)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return { session };
}

function parseBusiness(value: FormDataEntryValue | null): BusinessName | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if ((BUSINESS_NAMES as readonly string[]).includes(normalized)) {
    return normalized as BusinessName;
  }
  return null;
}

function extractString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file upload' }, { status: 400 });
  }

  const business = parseBusiness(form.get('business'));
  if (!business) {
    return NextResponse.json({ error: 'Invalid business selection' }, { status: 400 });
  }

  const customerName = extractString(form.get('customerName'));
  const orderReference = extractString(form.get('orderReference'));

  if (!customerName) {
    return NextResponse.json({ error: 'Customer name is required for uploads' }, { status: 400 });
  }

  if (!orderReference) {
    return NextResponse.json({ error: 'Order reference is required for uploads' }, { status: 400 });
  }

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
