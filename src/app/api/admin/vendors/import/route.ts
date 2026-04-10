import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { mapVendorImportRows, previewVendorImport } from '@/modules/vendors/vendor-import';

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerAuthSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  if (!canAccessAdmin(user)) return new NextResponse('Forbidden', { status: 403 });
  return null;
}

function parsePositiveInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const form = await req.formData();
  const action = parseString(form.get('action'));
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing spreadsheet upload' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sheetName = parseString(form.get('sheetName'));
  const headerRow = parsePositiveInt(form.get('headerRow'));

  try {
    if (action === 'preview') {
      const preview = previewVendorImport(buffer, { sheetName, headerRow });
      return NextResponse.json(preview);
    }

    if (action === 'import') {
      const duplicateMode = parseString(form.get('duplicateMode')) === 'update' ? 'update' : 'skip';
      const rows = mapVendorImportRows(buffer, {
        sheetName,
        headerRow,
        nameColumn: parseString(form.get('nameColumn')) ?? '',
        urlColumn: parseString(form.get('urlColumn')) ?? null,
        phoneColumn: parseString(form.get('phoneColumn')) ?? null,
        contactColumn: parseString(form.get('contactColumn')) ?? null,
        materialsColumn: parseString(form.get('materialsColumn')) ?? null,
        notesColumns: parseStringArray(form.get('notesColumns')),
        appendUnmappedToNotes: String(form.get('appendUnmappedToNotes')) === 'true',
        duplicateMode,
      });

      const existingNames = new Map(
        (
          await prisma.vendor.findMany({
            where: { name: { in: rows.map((row) => row.name) } },
            select: { id: true, name: true },
          })
        ).map((item) => [item.name.toLowerCase(), item])
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      const sample: Array<{
        name: string;
        url?: string;
        phone?: string;
        contact?: string;
        materials?: string;
        notes?: string;
        action: 'create' | 'update' | 'skip';
      }> = [];

      for (const row of rows) {
        const existing = existingNames.get(row.name.toLowerCase());
        try {
          if (existing) {
            if (duplicateMode === 'update') {
              await prisma.vendor.update({
                where: { id: existing.id },
                data: {
                  url: row.url,
                  phone: row.phone,
                  contact: row.contact,
                  materials: row.materials,
                  notes: row.notes,
                },
              });
              updated += 1;
              if (sample.length < 10) sample.push({ ...row, action: 'update' });
            } else {
              skipped += 1;
              if (sample.length < 10) sample.push({ ...row, action: 'skip' });
            }
          } else {
            await prisma.vendor.create({ data: row });
            created += 1;
            if (sample.length < 10) sample.push({ ...row, action: 'create' });
          }
        } catch (error: any) {
          errors.push(`${row.name}: ${typeof error?.message === 'string' ? error.message : 'Import failed'}`);
        }
      }

      return NextResponse.json({
        created,
        updated,
        skipped,
        duplicateRowsCollapsed: rows.length,
        errors,
        sample,
      });
    }

    return NextResponse.json({ error: 'Unsupported import action' }, { status: 400 });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
