import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { BUSINESS_NAMES, storeAttachmentFile, type BusinessName } from '@/lib/storage';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const role = (session.user as any)?.role || 'VIEWER';
  if (!canAccessAdmin(role)) {
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

  const customerNameRaw = form.get('customerName');
  const quoteNumberRaw = form.get('quoteNumber');
  const customerName = typeof customerNameRaw === 'string' ? customerNameRaw.trim() : '';
  const quoteNumber = typeof quoteNumberRaw === 'string' ? quoteNumberRaw.trim() : '';

  if (!customerName) {
    return NextResponse.json({ error: 'Customer name is required for uploads' }, { status: 400 });
  }
  if (!quoteNumber) {
    return NextResponse.json({ error: 'Quote number is required for uploads' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: quoteNumber,
      originalFilename: file.name,
      buffer,
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
