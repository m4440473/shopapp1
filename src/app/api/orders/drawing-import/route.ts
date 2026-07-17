import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { BUSINESS_NAMES, type BusinessName } from '@/lib/businesses';
import { importDrawingUpload } from '@/modules/drawing-import/drawing-import.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Send the drawing as a multipart file upload.' }, { status: 400 });
  const file = form.get('file');
  const business = typeof form.get('business') === 'string' ? String(form.get('business')).trim() : '';
  const customerName = typeof form.get('customerName') === 'string' ? String(form.get('customerName')).trim() : '';
  const draftReference = typeof form.get('draftReference') === 'string' ? String(form.get('draftReference')).trim() : '';

  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a drawing or ZIP.' }, { status: 400 });
  if (!(BUSINESS_NAMES as readonly string[]).includes(business)) {
    return NextResponse.json({ error: 'Choose a valid business.' }, { status: 400 });
  }
  if (!customerName) return NextResponse.json({ error: 'Choose a customer before importing drawings.' }, { status: 400 });
  if (!draftReference) return NextResponse.json({ error: 'Missing draft reference.' }, { status: 400 });

  try {
    const proposals = await importDrawingUpload({
      file,
      business: business as BusinessName,
      customerName,
      draftReference,
    });
    return NextResponse.json({ proposals });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import these drawings.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
