import type { BomDrawingPageCandidate, BomPageMatch, BomPageMatchCandidate, DrawingBomRow } from './bom.types';

export type BomPageMatchOptions = {
  knownPartNumberPrefixes?: string[];
  knownPartNumberSuffixes?: string[];
};

export function normalizeBomPartNumber(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*([./_-])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeDescription(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function filenameStem(filename: string | null | undefined) {
  const name = (filename ?? '').split(/[\\/]/).pop() ?? '';
  return name.replace(/\.[^.]+$/, '');
}

function configuredVariants(value: string, options: BomPageMatchOptions) {
  const variants = new Set([value]);
  for (const prefix of options.knownPartNumberPrefixes ?? []) {
    const normalized = normalizeBomPartNumber(prefix);
    if (normalized && value.startsWith(normalized)) variants.add(value.slice(normalized.length).replace(/^[-_. /]+/, ''));
  }
  for (const suffix of options.knownPartNumberSuffixes ?? []) {
    const normalized = normalizeBomPartNumber(suffix);
    if (normalized && value.endsWith(normalized)) variants.add(value.slice(0, -normalized.length).replace(/[-_. /]+$/, ''));
  }
  return variants;
}

function exactConfiguredAgreement(left: string, right: string, options: BomPageMatchOptions) {
  if (!left || !right) return false;
  const leftVariants = configuredVariants(left, options);
  const rightVariants = configuredVariants(right, options);
  return [...leftVariants].some((variant) => variant && rightVariants.has(variant));
}

function scoreCandidate(row: DrawingBomRow, page: BomDrawingPageCandidate, options: BomPageMatchOptions): BomPageMatchCandidate | null {
  const rowPartNumber = normalizeBomPartNumber(row.partNumber.value);
  const pagePartNumber = normalizeBomPartNumber(page.partNumber.value);
  const filename = normalizeBomPartNumber(filenameStem(page.filename));
  const signals: string[] = [];
  let score = 0;

  if (rowPartNumber && pagePartNumber === rowPartNumber) {
    score = 100;
    signals.push('exact_part_number');
  } else if (exactConfiguredAgreement(rowPartNumber, pagePartNumber, options)) {
    score = 90;
    signals.push('configured_part_number_normalization');
  } else if (filename === rowPartNumber) {
    score = 80;
    signals.push('exact_filename');
  } else {
    return null;
  }

  const rowItem = normalizeBomPartNumber(row.item.value);
  if (rowItem && (page.itemReferences ?? []).some((item) => normalizeBomPartNumber(item) === rowItem)) {
    score += 10;
    signals.push('item_number');
  }
  const rowDescription = normalizeDescription(row.description.value);
  const pageDescription = normalizeDescription(page.partName?.value);
  if (rowDescription && pageDescription && rowDescription === pageDescription) {
    score += 5;
    signals.push('exact_description');
  }

  const rowRevision = normalizeBomPartNumber(row.revision.value);
  const pageRevision = normalizeBomPartNumber(page.revision.value);
  const revisionConflict = Boolean(rowRevision && pageRevision && rowRevision !== pageRevision);
  if (rowRevision && pageRevision && rowRevision === pageRevision) {
    score += 5;
    signals.push('revision');
  }
  return { pageId: page.pageId, score, signals, revisionConflict };
}

export function matchBomRowsToDrawingPages(
  rows: DrawingBomRow[],
  pages: BomDrawingPageCandidate[],
  options: BomPageMatchOptions = {},
): BomPageMatch[] {
  return rows.map((row) => {
    const normalizedPartNumber = normalizeBomPartNumber(row.partNumber.value);
    if (!normalizedPartNumber) {
      return {
        rowId: row.id,
        status: 'invalid_part_number' as const,
        matchedPageId: null,
        candidates: [],
        warnings: ['BOM row has no normalized part number and cannot be matched.'],
      };
    }

    const candidates = pages
      .map((page) => scoreCandidate(row, page, options))
      .filter((candidate): candidate is BomPageMatchCandidate => candidate !== null)
      .sort((left, right) => right.score - left.score || left.pageId.localeCompare(right.pageId));
    if (!candidates.length) {
      return {
        rowId: row.id,
        status: 'missing' as const,
        matchedPageId: null,
        candidates: [],
        warnings: [`No drawing page exactly matched BOM part ${row.partNumber.value}.`],
      };
    }

    const nonConflicting = candidates.filter((candidate) => !candidate.revisionConflict);
    if (!nonConflicting.length) {
      return {
        rowId: row.id,
        status: 'revision_conflict' as const,
        matchedPageId: null,
        candidates,
        warnings: [`Every exact part-number candidate conflicts with BOM revision ${row.revision.value}.`],
      };
    }
    const topScore = nonConflicting[0].score;
    const top = nonConflicting.filter((candidate) => candidate.score === topScore);
    if (top.length !== 1) {
      return {
        rowId: row.id,
        status: 'ambiguous' as const,
        matchedPageId: null,
        candidates,
        warnings: [`Multiple drawing pages equally match BOM part ${row.partNumber.value}.`],
      };
    }
    return {
      rowId: row.id,
      status: 'matched' as const,
      matchedPageId: top[0].pageId,
      candidates,
      warnings: candidates.some((candidate) => candidate.revisionConflict)
        ? ['A lower-ranked candidate had a conflicting revision and was not selected.']
        : [],
    };
  });
}
