export type MaterialMatchOption = { id: string; name: string };

const GENERIC_TOKENS = new Set([
  'ALLOY',
  'ALUMINUM',
  'BAR',
  'MATERIAL',
  'PLATE',
  'ROUND',
  'SHEET',
  'STEEL',
  'TUBE',
]);

function normalizeMaterialName(value: string) {
  return value
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\bCOLD[ -]?ROLLED?\s+STEEL\b|\bCOLD[ -]?ROLL\s+STEEL\b/g, ' CRS ')
    .replace(/\bHOT[ -]?ROLLED?\s+STEEL\b|\bHOT[ -]?ROLL\s+STEEL\b/g, ' HRS ')
    .replace(/\bSTAINLESS\s+STEEL\b/g, ' SS ')
    .replace(/\bPRE[ -]?HARD(?:ENED)?\b/g, ' PH ')
    .replace(/\bALUMINIUM\b/g, ' ALUMINUM ')
    .replace(/\bACETAL\b/g, ' DELRIN ')
    .replace(/\bTEFLON\b/g, ' PTFE ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSimilarity(left: string, right: string) {
  if (left === right) return 1;
  if (left.length >= 2 && right.length >= 2 && (left.startsWith(right) || right.startsWith(left))) return 0.7;
  return 0;
}

export function bestMaterialMatch(raw: string | null, materials: MaterialMatchOption[]) {
  const normalizedRaw = normalizeMaterialName(raw ?? '');
  if (!normalizedRaw) return '';
  const rawCompact = normalizedRaw.replace(/\s/g, '');
  const rawTokens = normalizedRaw.split(' ').filter((token) => !GENERIC_TOKENS.has(token));

  const scored = materials.map((material, index) => {
    const normalizedName = normalizeMaterialName(material.name);
    const nameCompact = normalizedName.replace(/\s/g, '');
    const nameTokens = normalizedName.split(' ').filter((token) => !GENERIC_TOKENS.has(token));
    let score = 0;
    if (normalizedName === normalizedRaw) score = 100;
    else if (nameCompact === rawCompact) score = 98;
    else if (rawCompact.length >= 3 && (nameCompact.includes(rawCompact) || rawCompact.includes(nameCompact))) score = 90;

    for (const rawToken of rawTokens) {
      const similarity = Math.max(0, ...nameTokens.map((nameToken) => tokenSimilarity(rawToken, nameToken)));
      score += similarity * (/\d/.test(rawToken) ? 35 : 20);
    }
    return { material, score, index };
  }).filter((entry) => entry.score >= 20);

  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  if (!scored.length) return '';
  if (scored[1] && scored[0].score === scored[1].score) return '';
  return scored[0].material.id;
}

export function buildFinishPartNotes(finish: string | null | undefined) {
  const normalized = finish?.trim();
  return normalized ? `Finish: ${normalized}` : '';
}

export function parseInchMeasurement(value: string | null | undefined): number | null {
  const normalized = value?.trim().replace(/[″"]/g, '').replace(/\s+IN(?:CH(?:ES)?)?\.?$/i, '');
  if (!normalized) return null;
  const mixed = normalized.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (!denominator) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }
  const fraction = normalized.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }
  const decimal = Number(normalized);
  return Number.isFinite(decimal) ? decimal : null;
}

function formatInches(value: number) {
  return value.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function deriveCutAndStockLength(finalPartLength: string | null | undefined, quantity: number) {
  const finalLength = parseInchMeasurement(finalPartLength);
  if (finalLength === null || finalLength < 0) return { cutLength: '', stockLength: '' };
  const cutLength = finalLength + 0.125;
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
  return {
    cutLength: formatInches(cutLength),
    stockLength: formatInches(cutLength * safeQuantity),
  };
}

export function formatTotalStockDimensions(
  partThickness: string | null | undefined,
  partWidth: string | null | undefined,
  totalStockLength: string | null | undefined,
) {
  const thickness = partThickness?.trim();
  const width = partWidth?.trim();
  const length = totalStockLength?.trim();
  if (!thickness || !width || !length) return '';
  return `${thickness} × ${width} × ${length}`;
}

export function deriveDrawingStockDimensions(
  partThickness: string | null | undefined,
  partWidth: string | null | undefined,
  finalPartLength: string | null | undefined,
  quantity: number,
) {
  const lengths = deriveCutAndStockLength(finalPartLength, quantity);
  return {
    ...lengths,
    totalStockDimensions: formatTotalStockDimensions(partThickness, partWidth, lengths.stockLength),
  };
}

export function parseDrawingQuantityInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}
