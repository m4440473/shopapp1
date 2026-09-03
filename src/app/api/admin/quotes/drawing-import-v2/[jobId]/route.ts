import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import {
  getQuoteDrawingImportV2JobSnapshot,
  saveQuoteDrawingImportV2Classification,
  saveQuoteDrawingImportV2FieldCorrection,
} from '@/modules/drawing-import/v2/drawing-import-v2.service';
import { DRAWING_IMPORT_FIELD_NAMES, type DrawingImportPageClassification } from '@/modules/drawing-import/v2/drawing-import-v2.types';

export const runtime = 'nodejs';
const classifications = new Set<DrawingImportPageClassification>(['part_drawing', 'assembly_drawing', 'bom', 'cover_sheet', 'reference', 'duplicate', 'uncertain']);

async function authorized() {
  const session = await getServerAuthSession();
  return Boolean(session && canAccessAdmin(session.user as any));
}

export async function GET(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  if (!await authorized()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { jobId } = await context.params;
    return NextResponse.json(await getQuoteDrawingImportV2JobSnapshot(jobId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import not found.' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  if (!await authorized()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { jobId } = await context.params;
    const body = await req.json() as Record<string, unknown>;
    const pageId = typeof body.pageId === 'string' ? body.pageId : '';
    if (!pageId) throw new Error('Missing drawing page.');
    if (body.kind === 'classification') {
      const classification = body.classification as DrawingImportPageClassification;
      if (!classifications.has(classification)) throw new Error('Choose a valid page type.');
      return NextResponse.json(await saveQuoteDrawingImportV2Classification({ jobId, pageId, classification }));
    }
    const field = typeof body.field === 'string' ? body.field : '';
    if (!(DRAWING_IMPORT_FIELD_NAMES as readonly string[]).includes(field)) throw new Error('Choose a valid drawing field.');
    return NextResponse.json(await saveQuoteDrawingImportV2FieldCorrection({
      jobId,
      pageId,
      field: field as (typeof DRAWING_IMPORT_FIELD_NAMES)[number],
      value: body.value as string | number | boolean | null,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save drawing review.' }, { status: 400 });
  }
}
