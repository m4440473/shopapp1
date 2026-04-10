import * as XLSX from 'xlsx';

export type VendorImportColumnSuggestion = 'name' | 'url' | 'phone' | 'contact' | 'materials' | 'notes';

export type VendorImportPreview = {
  sheetNames: string[];
  selectedSheet: string;
  headerRow: number;
  columns: string[];
  previewRows: Array<Record<string, string>>;
  rawPreviewRows: string[][];
  totalRows: number;
  suggestions: {
    name: string | null;
    url: string | null;
    phone: string | null;
    contact: string | null;
    materials: string | null;
    notes: string[];
  };
};

export type VendorImportMapping = {
  nameColumn: string;
  urlColumn?: string | null;
  phoneColumn?: string | null;
  contactColumn?: string | null;
  materialsColumn?: string | null;
  notesColumns?: string[];
  appendUnmappedToNotes?: boolean;
  duplicateMode?: 'skip' | 'update';
};

export type VendorImportResult = {
  created: number;
  updated: number;
  skipped: number;
  duplicateRowsCollapsed: number;
  errors: string[];
  sample: Array<{
    name: string;
    url?: string;
    phone?: string;
    contact?: string;
    materials?: string;
    notes?: string;
    action: 'create' | 'update' | 'skip';
  }>;
};

type VendorRowRecord = Record<string, string>;

function toDisplayString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).trim();
}

function normalizeMatrix(matrix: unknown[][]): string[][] {
  return matrix.map((row) => row.map((value) => toDisplayString(value)));
}

function countFilled(row: string[]): number {
  return row.filter((value) => value.trim()).length;
}

function scoreHeaderRow(row: string[]): number {
  const joined = row.join(' ').toLowerCase();
  let score = countFilled(row);
  if (joined.includes('company')) score += 6;
  if (joined.includes('vendor')) score += 6;
  if (joined.includes('supplier')) score += 6;
  if (joined.includes('name')) score += 4;
  if (joined.includes('phone')) score += 4;
  if (joined.includes('contact')) score += 4;
  if (joined.includes('web')) score += 3;
  if (joined.includes('url')) score += 3;
  return score;
}

export function detectHeaderRow(rows: string[][]): number {
  const searchSpace = rows.slice(0, 15);
  let bestIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < searchSpace.length; index += 1) {
    const score = scoreHeaderRow(searchSpace[index] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex + 1;
}

function uniquifyHeaders(headerRow: string[]): string[] {
  const counts = new Map<string, number>();
  return headerRow.map((value, index) => {
    const base = value.trim() || `Column ${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} (${seen + 1})`;
  });
}

function parseSheetRows(buffer: Buffer, sheetName?: string): { sheetNames: string[]; selectedSheet: string; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheetNames = workbook.SheetNames ?? [];
  if (!sheetNames.length) {
    throw new Error('The uploaded workbook does not contain any sheets.');
  }

  const selectedSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[selectedSheet];
  if (!worksheet) {
    throw new Error('The selected sheet could not be read.');
  }

  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  }) as unknown[][];

  return {
    sheetNames,
    selectedSheet,
    rows: normalizeMatrix(matrix),
  };
}

function buildRowRecords(rows: string[][], columns: string[], headerRow: number): VendorRowRecord[] {
  return rows
    .slice(headerRow)
    .map((row) => {
      const record: VendorRowRecord = {};
      columns.forEach((column, index) => {
        record[column] = row[index]?.trim() ?? '';
      });
      return record;
    })
    .filter((record) => Object.values(record).some((value) => value));
}

function findSuggestedColumn(columns: string[], target: VendorImportColumnSuggestion): string | null {
  const scored = columns
    .map((column) => {
      const lower = column.toLowerCase();
      let score = -1;

      if (target === 'name') {
        if (/(company|vendor|supplier|name)/.test(lower)) score = 10;
      } else if (target === 'url') {
        if (/(web|website|url|link|page)/.test(lower)) score = 10;
      } else if (target === 'phone') {
        if (/(phone|telephone|tel)/.test(lower)) score = 10;
      } else if (target === 'contact') {
        if (/(contact|buyer|sales|rep)/.test(lower)) score = 10;
      } else if (target === 'materials') {
        if (/(material|metals|specialty|specialties|stock)/.test(lower)) score = 10;
      } else if (target === 'notes') {
        if (/(contact|fax|email|address|city|state|zip|category|type|note)/.test(lower)) score = 10;
      }

      return { column, score };
    })
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.column.localeCompare(right.column));

  return scored[0]?.column ?? null;
}

function buildSuggestedNotes(columns: string[], used: Set<string>): string[] {
  return columns.filter((column) => {
    if (used.has(column)) return false;
    const lower = column.toLowerCase();
    return /(contact|fax|email|address|city|state|zip|category|type|note)/.test(lower);
  });
}

export function previewVendorImport(buffer: Buffer, options?: { sheetName?: string; headerRow?: number }): VendorImportPreview {
  const parsed = parseSheetRows(buffer, options?.sheetName);
  const headerRow = Math.max(1, Math.min(options?.headerRow ?? detectHeaderRow(parsed.rows), Math.max(parsed.rows.length, 1)));
  const header = uniquifyHeaders(parsed.rows[headerRow - 1] ?? []);
  const rowRecords = buildRowRecords(parsed.rows, header, headerRow);
  const name = findSuggestedColumn(header, 'name');
  const url = findSuggestedColumn(header, 'url');
  const phone = findSuggestedColumn(header, 'phone');
  const contact = findSuggestedColumn(header, 'contact');
  const materials = findSuggestedColumn(header, 'materials');
  const used = new Set([name, url, phone, contact, materials].filter(Boolean) as string[]);

  return {
    sheetNames: parsed.sheetNames,
    selectedSheet: parsed.selectedSheet,
    headerRow,
    columns: header,
    previewRows: rowRecords.slice(0, 10),
    rawPreviewRows: parsed.rows.slice(0, 12),
    totalRows: rowRecords.length,
    suggestions: {
      name,
      url,
      phone,
      contact,
      materials,
      notes: buildSuggestedNotes(header, used),
    },
  };
}

function normalizeUrl(value: string): { url?: string; note?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return { url: url.toString() };
  } catch {
    return { note: trimmed };
  }
}

function buildNotes(record: VendorRowRecord, columns: string[], mapping: VendorImportMapping): string | undefined {
  const noteColumns = new Set((mapping.notesColumns ?? []).filter(Boolean));
  const explicitlyMapped = new Set(
    [
      mapping.nameColumn,
      mapping.urlColumn ?? '',
      mapping.phoneColumn ?? '',
      mapping.contactColumn ?? '',
      mapping.materialsColumn ?? '',
    ].filter(Boolean)
  );

  if (mapping.appendUnmappedToNotes) {
    columns.forEach((column) => {
      if (!explicitlyMapped.has(column) && record[column]) {
        noteColumns.add(column);
      }
    });
  }

  const lines = Array.from(noteColumns)
    .map((column) => {
      const value = record[column]?.trim();
      if (!value) return null;
      return `${column}: ${value}`;
    })
    .filter((line): line is string => Boolean(line));

  if (!lines.length) return undefined;

  const notes = lines.join('\n');
  return notes.length > 500 ? `${notes.slice(0, 497)}...` : notes;
}

export function mapVendorImportRows(
  buffer: Buffer,
  mapping: VendorImportMapping & { sheetName?: string; headerRow?: number }
): Array<{ name: string; url?: string; phone?: string; contact?: string; materials?: string; notes?: string }> {
  const preview = previewVendorImport(buffer, {
    sheetName: mapping.sheetName,
    headerRow: mapping.headerRow,
  });

  if (!mapping.nameColumn || !preview.columns.includes(mapping.nameColumn)) {
    throw new Error('A valid vendor name column is required.');
  }

  const parsed = parseSheetRows(buffer, preview.selectedSheet);
  const columns = preview.columns;
  const records = buildRowRecords(parsed.rows, columns, preview.headerRow);
  const deduped = new Map<
    string,
    { name: string; url?: string; phone?: string; contact?: string; materials?: string; notes?: string }
  >();

  for (const record of records) {
    const name = record[mapping.nameColumn]?.trim();
    if (!name) continue;

    const phone = mapping.phoneColumn ? record[mapping.phoneColumn]?.trim() || undefined : undefined;
    const contact = mapping.contactColumn ? record[mapping.contactColumn]?.trim() || undefined : undefined;
    const materials = mapping.materialsColumn ? record[mapping.materialsColumn]?.trim() || undefined : undefined;
    const notes = buildNotes(record, columns, mapping);
    let url: string | undefined;
    let extraUrlNote: string | undefined;

    if (mapping.urlColumn) {
      const normalized = normalizeUrl(record[mapping.urlColumn] ?? '');
      url = normalized.url;
      extraUrlNote = normalized.note;
    }

    const mergedNotes = [notes, extraUrlNote ? `${mapping.urlColumn ?? 'URL'}: ${extraUrlNote}` : undefined]
      .filter(Boolean)
      .join('\n')
      .trim();

    deduped.set(name.toLowerCase(), {
      name,
      url,
      phone,
      contact,
      materials,
      notes: mergedNotes || undefined,
    });
  }

  return Array.from(deduped.values());
}
