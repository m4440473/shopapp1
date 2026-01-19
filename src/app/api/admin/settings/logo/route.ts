import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import { getAppSettings, updateAppSettings } from '@/lib/app-settings';
import { ensureAttachmentRoot } from '@/lib/storage';

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

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing logo upload' }, { status: 400 });
  }

  const settings = await getAppSettings();
  const root = await ensureAttachmentRoot(settings.attachmentsDir);
  const brandingDir = path.join(root, 'branding');
  await mkdir(brandingDir, { recursive: true });

  const extension = path.extname(file.name || '').toLowerCase() || '.png';
  const filename = `logo-${randomUUID()}${extension}`;
  const absolutePath = path.join(brandingDir, filename);
  const storagePath = path.posix.join('branding', filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const updated = await updateAppSettings({ logoPath: storagePath });

  return NextResponse.json({ ok: true, logoPath: updated.logoPath, url: '/branding/logo' });
}
