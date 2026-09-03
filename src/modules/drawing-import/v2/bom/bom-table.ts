import { emptyDrawingField, type DrawingImportEvidence, type DrawingImportFieldValue, type DrawingImportNormalizedRegion } from '../drawing-import-v2.types';
import type { BomColumnName, BomTableReconstruction, BomTextSpan, DrawingBomRow } from './bom.types';

const HEADER_ALIASES: Record<BomColumnName, string[]> = {
  item: ['ITEM', 'ITEM NO', 'ITEM NUMBER', 'FIND NO', 'FIND NUMBER'],
  partNumber: ['PART NUMBER', 'PART NO', 'PART #', 'DRAWING NUMBER', 'DRAWING NO', 'DWG NO'],
  description: ['DESCRIPTION', 'PART DESCRIPTION', 'NAME'],
  quantityPerParent: ['QTY', 'QUANTITY', 'QTY REQD', 'QTY REQUIRED', 'REQD'],
  material: ['MATERIAL', 'MATL', 'MAT L'],
  revision: ['REV', 'REVISION'],
};

type Line = { spans: BomTextSpan[]; centerY: number; region: DrawingImportNormalizedRegion };
type HeaderHit = { name: BomColumnName; centerX: number; label: string; spans: BomTextSpan[] };

export type ReconstructBomTableOptions = {
  parentAssemblyPartNumber?: string | null;
  parentAssemblyEvidence?: DrawingImportEvidence[];
  lineTolerance?: number;
};

function normalizedHeader(value: string) {
  return value
    .toUpperCase()
    .replace(/[#№]/g, ' # ')
    .replace(/[^A-Z0-9#]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function centerX(span: BomTextSpan) {
  return (span.region[0] + span.region[2]) / 2;
}

function centerY(span: BomTextSpan) {
  return (span.region[1] + span.region[3]) / 2;
}

function unionRegion(spans: BomTextSpan[]): DrawingImportNormalizedRegion {
  return [
    Math.min(...spans.map((span) => span.region[0])),
    Math.min(...spans.map((span) => span.region[1])),
    Math.max(...spans.map((span) => span.region[2])),
    Math.max(...spans.map((span) => span.region[3])),
  ];
}

function validSpan(span: BomTextSpan) {
  const [x1, y1, x2, y2] = span.region;
  return Boolean(span.text.trim()) && [x1, y1, x2, y2].every(Number.isFinite) && x1 >= 0 && y1 >= 0 && x2 <= 1 && y2 <= 1 && x2 >= x1 && y2 >= y1;
}

function groupLines(spans: BomTextSpan[], tolerance: number): Line[] {
  const sorted = [...spans].sort((left, right) => centerY(left) - centerY(right) || left.region[0] - right.region[0] || left.readingOrder - right.readingOrder);
  const lines: BomTextSpan[][] = [];
  for (const span of sorted) {
    const target = lines.find((line) => Math.abs(centerY(span) - line.reduce((sum, item) => sum + centerY(item), 0) / line.length) <= tolerance);
    if (target) target.push(span);
    else lines.push([span]);
  }
  return lines.map((lineSpans) => {
    lineSpans.sort((left, right) => left.region[0] - right.region[0] || left.readingOrder - right.readingOrder);
    return {
      spans: lineSpans,
      centerY: lineSpans.reduce((sum, span) => sum + centerY(span), 0) / lineSpans.length,
      region: unionRegion(lineSpans),
    };
  });
}

function headerHits(line: Line): HeaderHit[] {
  const candidates: Array<HeaderHit & { length: number; start: number }> = [];
  for (let start = 0; start < line.spans.length; start += 1) {
    for (let length = 1; length <= 3 && start + length <= line.spans.length; length += 1) {
      const spans = line.spans.slice(start, start + length);
      const label = normalizedHeader(spans.map((span) => span.text).join(' '));
      for (const [name, aliases] of Object.entries(HEADER_ALIASES) as Array<[BomColumnName, string[]]>) {
        if (aliases.includes(label)) {
          candidates.push({ name, label, spans, centerX: (spans[0].region[0] + spans[spans.length - 1].region[2]) / 2, length, start });
        }
      }
    }
  }

  candidates.sort((left, right) => right.length - left.length || left.start - right.start);
  const used = new Set<number>();
  const names = new Set<BomColumnName>();
  const selected: HeaderHit[] = [];
  for (const candidate of candidates) {
    if (names.has(candidate.name)) continue;
    const positions = candidate.spans.map((span) => line.spans.indexOf(span));
    if (positions.some((position) => used.has(position))) continue;
    positions.forEach((position) => used.add(position));
    names.add(candidate.name);
    selected.push(candidate);
  }
  return selected.sort((left, right) => left.centerX - right.centerX);
}

function fieldEvidence(pageId: string, spans: BomTextSpan[], parser: string): DrawingImportEvidence[] {
  if (!spans.length) return [];
  const rawText = spans.map((span) => span.text.trim()).filter(Boolean).join(' ');
  return [{
    sourceType: 'embedded_text',
    sourcePageId: pageId,
    sourceRegion: unionRegion(spans),
    sourceCropId: null,
    rawText,
    parser,
    agreementSignals: ['bom_table_column', 'bom_row_alignment'],
    warnings: [],
  }];
}

function textField(pageId: string, spans: BomTextSpan[], parser: string): DrawingImportFieldValue<string> {
  const rawText = spans.map((span) => span.text.trim()).filter(Boolean).join(' ').trim();
  if (!rawText) return emptyDrawingField<string>();
  return {
    value: rawText,
    rawText,
    status: 'read',
    evidence: fieldEvidence(pageId, spans, parser),
    candidates: [{
      value: rawText,
      sourceType: 'embedded_text',
      sourcePageId: pageId,
      sourceRegion: unionRegion(spans),
      rawText,
    }],
    warnings: [],
    diagnosticConfidence: null,
  };
}

function quantityField(pageId: string, spans: BomTextSpan[], parser: string): DrawingImportFieldValue<number> {
  const rawText = spans.map((span) => span.text.trim()).filter(Boolean).join(' ').trim();
  if (!rawText) return emptyDrawingField<number>();
  const normalized = rawText.replace(/[,\s]/g, '');
  const value = /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < 1) {
    return {
      ...emptyDrawingField<number>('unreadable'),
      rawText,
      evidence: fieldEvidence(pageId, spans, parser),
      warnings: [`BOM quantity “${rawText}” is not a positive integer.`],
    };
  }
  return {
    value,
    rawText,
    status: 'read',
    evidence: fieldEvidence(pageId, spans, parser),
    candidates: [{ value, sourceType: 'embedded_text', sourcePageId: pageId, sourceRegion: unionRegion(spans), rawText }],
    warnings: [],
    diagnosticConfidence: null,
  };
}

function parentField(pageId: string, options: ReconstructBomTableOptions): DrawingImportFieldValue<string> {
  const value = options.parentAssemblyPartNumber?.trim();
  if (!value) return emptyDrawingField<string>();
  return {
    value,
    rawText: value,
    status: options.parentAssemblyEvidence?.length ? 'read' : 'derived_locally',
    evidence: options.parentAssemblyEvidence?.length ? options.parentAssemblyEvidence : [{
      sourceType: 'embedded_text',
      sourcePageId: pageId,
      sourceRegion: null,
      sourceCropId: null,
      rawText: value,
      parser: 'bom_parent_context_v1',
      agreementSignals: ['bom_page_title_block'],
      warnings: [],
    }],
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}

function appendDescription(row: DrawingBomRow, pageId: string, spans: BomTextSpan[]) {
  const addition = spans.map((span) => span.text.trim()).filter(Boolean).join(' ').trim();
  if (!addition) return row;
  const current = row.description.value?.trim();
  const value = current ? `${current} ${addition}` : addition;
  return {
    ...row,
    description: {
      ...row.description,
      value,
      rawText: value,
      status: 'read' as const,
      evidence: [...row.description.evidence, ...fieldEvidence(pageId, spans, 'bom_table_v1')],
      warnings: row.description.warnings,
    },
    rawCells: { ...row.rawCells, description: value },
    sourceRegion: unionRegion([
      { pageId, text: '', region: row.sourceRegion, readingOrder: -1 },
      ...spans,
    ]),
  };
}

export function reconstructBomTable(
  sourcePageId: string,
  inputSpans: BomTextSpan[],
  options: ReconstructBomTableOptions = {},
): BomTableReconstruction {
  const warnings: string[] = [];
  const spans = inputSpans.filter((span) => span.pageId === sourcePageId && validSpan(span));
  if (spans.length !== inputSpans.filter((span) => span.pageId === sourcePageId).length) {
    warnings.push('Ignored empty or invalid coordinate spans while reconstructing the BOM.');
  }
  const lines = groupLines(spans, options.lineTolerance ?? 0.012);
  const headerCandidates = lines.map((line) => ({ line, hits: headerHits(line) }));
  headerCandidates.sort((left, right) => {
    const leftRequired = Number(left.hits.some((hit) => hit.name === 'partNumber')) + Number(left.hits.some((hit) => hit.name === 'quantityPerParent'));
    const rightRequired = Number(right.hits.some((hit) => hit.name === 'partNumber')) + Number(right.hits.some((hit) => hit.name === 'quantityPerParent'));
    return rightRequired - leftRequired || right.hits.length - left.hits.length || left.line.centerY - right.line.centerY;
  });
  const header = headerCandidates[0];
  if (!header || !header.hits.some((hit) => hit.name === 'partNumber') || !header.hits.some((hit) => hit.name === 'quantityPerParent')) {
    return {
      sourcePageId,
      headerRegion: null,
      detectedColumns: header?.hits.map(({ name, centerX: x, label }) => ({ name, centerX: x, label })) ?? [],
      rows: [],
      warnings: [...warnings, 'Could not establish both part-number and quantity BOM columns.'],
    };
  }

  const columns = header.hits;
  const boundaries = columns.map((column, index) => ({
    name: column.name,
    left: index === 0 ? 0 : (columns[index - 1].centerX + column.centerX) / 2,
    right: index === columns.length - 1 ? 1 : (column.centerX + columns[index + 1].centerX) / 2,
  }));
  const dataLines = lines.filter((line) => line.region[1] > header.line.region[3] - 0.002);
  const rows: DrawingBomRow[] = [];

  for (const line of dataLines) {
    const cells = new Map<BomColumnName, BomTextSpan[]>();
    for (const span of line.spans) {
      const x = centerX(span);
      const column = boundaries.find((candidate) => x >= candidate.left && x <= candidate.right);
      if (!column) continue;
      const values = cells.get(column.name) ?? [];
      values.push(span);
      cells.set(column.name, values);
    }
    const descriptionSpans = cells.get('description') ?? [];
    const hasIdentity = Boolean((cells.get('item') ?? []).length || (cells.get('partNumber') ?? []).length || (cells.get('quantityPerParent') ?? []).length);
    if (!hasIdentity && descriptionSpans.length && rows.length) {
      rows[rows.length - 1] = appendDescription(rows[rows.length - 1], sourcePageId, descriptionSpans);
      continue;
    }
    if (!hasIdentity) continue;

    const rowIndex = rows.length;
    const item = textField(sourcePageId, cells.get('item') ?? [], 'bom_table_v1');
    const partNumber = textField(sourcePageId, cells.get('partNumber') ?? [], 'bom_table_v1');
    const description = textField(sourcePageId, descriptionSpans, 'bom_table_v1');
    const quantityPerParent = quantityField(sourcePageId, cells.get('quantityPerParent') ?? [], 'bom_table_v1');
    const material = textField(sourcePageId, cells.get('material') ?? [], 'bom_table_v1');
    const revision = textField(sourcePageId, cells.get('revision') ?? [], 'bom_table_v1');
    const rowWarnings = [...quantityPerParent.warnings];
    if (!partNumber.value) rowWarnings.push('BOM row has no readable part number.');
    const rawCells = Object.fromEntries(
      [...cells.entries()].map(([name, cellSpans]) => [name, cellSpans.map((span) => span.text.trim()).filter(Boolean).join(' ')]),
    ) as Partial<Record<BomColumnName, string>>;
    rows.push({
      id: `${sourcePageId}:bom-row:${rowIndex + 1}`,
      sourcePageId,
      rowIndex,
      item,
      partNumber,
      description,
      quantityPerParent,
      material,
      revision,
      parentAssemblyPartNumber: parentField(sourcePageId, options),
      sourceRegion: line.region,
      rawCells,
      warnings: rowWarnings,
    });
  }

  if (!rows.length) warnings.push('BOM headers were found, but no aligned data rows were reconstructed.');
  return {
    sourcePageId,
    headerRegion: header.line.region,
    detectedColumns: columns.map(({ name, centerX: x, label }) => ({ name, centerX: x, label })),
    rows,
    warnings,
  };
}
