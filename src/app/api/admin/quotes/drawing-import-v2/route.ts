import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import {
  createQuoteDrawingImportV2Job,
  getQuoteDrawingImportV2FeatureStatus,
} from '@/modules/drawing-import/v2/drawing-import-v2.service';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function decoded(req: NextRequest, name: string) {
  const value = req.headers.get(name)?.trim() ?? '';
  try { return decodeURIComponent(value); } catch { return ''; }
}

async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!canAccessAdmin(session.user as any)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  return NextResponse.json(getQuoteDrawingImportV2FeatureStatus());
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  try {
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'This drawing upload is larger than 100 MB.' }, { status: 413 });
    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'This drawing upload is larger than 100 MB.' }, { status: 413 });
    const intakeMode = decoded(req, 'x-shopapp-intake-mode').toUpperCase() === 'ASSEMBLY' ? 'ASSEMBLY' : 'ONE_OFF';
    const result = await createQuoteDrawingImportV2Job({
      createdById: (auth.session.user as { id?: string }).id ?? null,
      destination: decoded(req, 'x-shopapp-destination') === 'order' ? 'order' : 'quote',
      business: decoded(req, 'x-shopapp-business'),
      customerName: decoded(req, 'x-shopapp-customer'),
      draftReference: decoded(req, 'x-shopapp-draft-reference'),
      intakeMode,
      assemblyMultiplier: Number(decoded(req, 'x-shopapp-assembly-multiplier') || 1),
      filename: decoded(req, 'x-shopapp-filename'),
      mimeType: req.headers.get('content-type'),
      buffer,
      idempotencyKey: decoded(req, 'x-shopapp-import-idempotency-key'),
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start drawing import.' }, { status: 400 });
  }
}
