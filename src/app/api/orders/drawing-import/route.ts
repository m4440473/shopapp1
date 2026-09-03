import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { BUSINESS_NAMES, type BusinessName } from '@/lib/businesses';
import { beginDrawingImportActivity } from '@/modules/drawing-import/drawing-import.activity';
import { importDrawingUpload } from '@/modules/drawing-import/drawing-import.service';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_RAW_UPLOAD_BYTES = 100 * 1024 * 1024;

function decodedUploadHeader(req: NextRequest, name: string) {
  const value = req.headers.get(name)?.trim() ?? '';
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessAdmin(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const activity = await beginDrawingImportActivity();
  try {
    let file: File | null = null;
    let business = '';
    let customerName = '';
    let draftReference = '';

    if (req.headers.get('x-shopapp-upload') === 'drawing-raw-v1') {
      const filename = decodedUploadHeader(req, 'x-shopapp-filename');
      business = decodedUploadHeader(req, 'x-shopapp-business').trim();
      customerName = decodedUploadHeader(req, 'x-shopapp-customer').trim();
      draftReference = decodedUploadHeader(req, 'x-shopapp-draft-reference').trim();
      const contentLength = Number(req.headers.get('content-length') ?? 0);
      if (contentLength > MAX_RAW_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'This drawing upload is larger than 100 MB.' }, { status: 413 });
      }
      await activity.record(`raw-body-start filename=${filename || 'missing'} contentLength=${contentLength || 'unknown'}`);
      const uploadBuffer = Buffer.from(await req.arrayBuffer());
      await activity.record(`raw-body-complete bytes=${uploadBuffer.length}`);
      if (uploadBuffer.length > MAX_RAW_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'This drawing upload is larger than 100 MB.' }, { status: 413 });
      }
      if (filename) {
        file = new File([uploadBuffer], filename, {
          type: req.headers.get('content-type') || 'application/octet-stream',
        });
      }
    } else {
      await activity.record('multipart-body-start');
      const form = await req.formData().catch(() => null);
      if (!form) return NextResponse.json({ error: 'Send the drawing as a file upload.' }, { status: 400 });
      await activity.record('multipart-body-complete');
      const formFile = form.get('file');
      file = formFile instanceof File ? formFile : null;
      business = typeof form.get('business') === 'string' ? String(form.get('business')).trim() : '';
      customerName = typeof form.get('customerName') === 'string' ? String(form.get('customerName')).trim() : '';
      draftReference = typeof form.get('draftReference') === 'string' ? String(form.get('draftReference')).trim() : '';
    }

    if (!file) return NextResponse.json({ error: 'Choose a drawing or ZIP.' }, { status: 400 });
    if (!(BUSINESS_NAMES as readonly string[]).includes(business)) {
      return NextResponse.json({ error: 'Choose a valid business.' }, { status: 400 });
    }
    if (!customerName) return NextResponse.json({ error: 'Choose a customer before importing drawings.' }, { status: 400 });
    if (!draftReference) return NextResponse.json({ error: 'Missing draft reference.' }, { status: 400 });

    await activity.record('drawing-import-start');
    const result = await importDrawingUpload({
      file,
      business: business as BusinessName,
      customerName,
      draftReference,
      onProgress: (event) => activity.record(event),
    });
    await activity.record(`drawing-import-complete proposals=${result.proposals.length}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import these drawings.';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await activity.finish();
  }
}
