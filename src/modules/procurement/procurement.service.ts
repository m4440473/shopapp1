import { listProcurementParts } from './procurement.repo';
import type {
  ProcurementFilters, ProcurementGroup, ProcurementGroupingResult, ProcurementGroupMember,
  ProcurementPartRow,
} from './procurement.types';

const EPSILON = 0.000_01;

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function parseDimension(value?: string | null): number | null {
  let text = clean(value)?.toLowerCase().replace(/["″]/g, '').trim();
  if (!text) return null;
  let multiplier = 1;
  if (/\bmm\b/.test(text)) { multiplier = 1 / 25.4; text = text.replace(/\bmm\b/g, '').trim(); }
  else text = text.replace(/\b(?:in|inch|inches)\b/g, '').trim();
  const mixed = text.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return positiveDimension((Number(mixed[1]) + Number(mixed[2]) / denominator) * multiplier, denominator);
  }
  const fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fraction) return positiveDimension((Number(fraction[1]) / Number(fraction[2])) * multiplier, Number(fraction[2]));
  const number = Number(text.replace(/^\./, '0.'));
  return positiveDimension(number * multiplier);
}

function positiveDimension(value: number, denominator = 1): number | null {
  return Number.isFinite(value) && Number.isFinite(denominator) && denominator > 0 && value > 0 ? rounded(value) : null;
}

function rounded(value: number) { return Math.round(value * 1_000_000) / 1_000_000; }
function same(a: number, b: number) { return Math.abs(a - b) <= EPSILON; }

function displayInches(value: number) {
  const common = [2, 4, 8, 16, 32, 64];
  const whole = Math.floor(value + EPSILON);
  const remainder = value - whole;
  for (const denominator of common) {
    const numerator = Math.round(remainder * denominator);
    if (Math.abs(remainder - numerator / denominator) <= EPSILON) {
      if (!numerator) return `${whole} in`;
      const divisor = gcd(numerator, denominator);
      return `${whole ? `${whole} ` : ''}${numerator / divisor}/${denominator / divisor} in`;
    }
  }
  return `${Number(value.toFixed(6))} in`;
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

function materialFacts(row: ProcurementPartRow) {
  const raw = clean(row.drawingMaterialText) ?? clean(row.materialName);
  const text = (raw ?? '').toUpperCase().replace(/[–—]/g, '-');
  const grade = text.match(/\b(1018|1020|1045|4140|4340|6061|7075|304|316)\b/)?.[1] ?? null;
  const process = /\bDOM\b|DRAWN\s+OVER\s+MANDREL/.test(text) ? 'DOM' : null;
  const standard = text.match(/\bA(?:STM\s*)?(\d{3,4})\b/)?.[1];
  const specification = [process, standard ? `A${standard}` : null].filter(Boolean).join('+') || null;
  const temper = text.match(/\bT\d{1,4}\b/)?.[0] ?? null;
  const hardness = text.match(/\b\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*HRC\b/)?.[0]?.replace(/\s+/g, '').replace('–', '-') ?? null;
  const conditionParts = [
    /\b(?:CRS?|COLD\s+ROLLED)\b/.test(text) ? 'cold_rolled' : null,
    /\b(?:HRS?|HOT\s+ROLLED)\b/.test(text) ? 'hot_rolled' : null,
    /\bANNEALED\b/.test(text) ? 'annealed' : null,
    /\b(?:PRE[- ]?HARD(?:ENED)?)\b/.test(text) ? 'pre_hardened' : null,
    /\b(?:HEAT\s*TREATED|HT)\b/.test(text) ? 'heat_treated' : null,
    temper, hardness,
  ];
  const condition = conditionParts.filter(Boolean).join('+') || null;
  const explicitRound = /\b(?:RND|ROUND)\b/.test(text);
  const roundTube = /\b(?:ROUND\s+TUB(?:E|ING)?|TUB(?:E|ING)?\s*,?\s*ROUND)\b/.test(text);
  const rectangularTube = /RECT(?:ANGULAR)?\s+TUB/.test(text);
  const explicitFlat = /\bFLAT(?:\s+BAR)?\b/.test(text) && !explicitRound;
  return { raw, text, grade, specification, condition, explicitRound, roundTube, rectangularTube, explicitFlat, process };
}

function normalize(row: ProcurementPartRow): ProcurementGroupMember & { exactKey: string | null; possibleKey: string | null } {
  const facts = materialFacts(row);
  const width = parseDimension(row.partWidth);
  const thickness = parseDimension(row.partThickness);
  const stockTokens = (clean(row.stockSize) ?? '').split(/\s*[x×]\s*/i).map(parseDimension);
  const evidence: string[] = [];
  const reasons: string[] = [];
  let profile: ProcurementGroupMember['normalized']['profile'] = null;
  const dimensions: Record<string, string> = {};

  if (facts.process === 'DOM') {
    profile = 'round_tube';
    const od = width ?? stockTokens[1] ?? null;
    const wall = thickness ?? stockTokens[0] ?? null;
    if (od && wall && wall < od / 2) {
      dimensions.od = displayInches(od); dimensions.wall = displayInches(wall);
      evidence.push('DOM profile inferred from material text; OD/wall inferred from width/thickness');
      reasons.push('DOM OD/wall came from legacy width/thickness fields and requires review');
      if ((stockTokens[0] && !same(stockTokens[0], wall)) || (stockTokens[1] && !same(stockTokens[1], od))) reasons.push('Stock-size cross-section conflicts with structured width/thickness');
    } else {
      profile = null;
      reasons.push('Tube dimensions are missing, invalid, or conflicting');
    }
  } else if (facts.roundTube) {
    profile = 'round_tube';
    const tubeNumber = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
    const odText = facts.text.match(new RegExp(`${tubeNumber}\\s*(?:IN(?:CH(?:ES)?)?|["″])?\\s*O\\.?D\\.?\\b`))?.[1];
    const wallText = facts.text.match(new RegExp(`(?:WALL|WT)\\s*(?:THICKNESS)?\\s*[:=]?\\s*${tubeNumber}`))?.[1]
      ?? facts.text.match(new RegExp(`${tubeNumber}\\s*(?:IN(?:CH(?:ES)?)?|["″])?\\s*(?:WALL|WT)\\b`))?.[1];
    const idText = facts.text.match(new RegExp(`${tubeNumber}\\s*(?:IN(?:CH(?:ES)?)?|["″])?\\s*I\\.?D\\.?\\b`))?.[1];
    const od = parseDimension(odText) ?? width; const wall = parseDimension(wallText) ?? thickness; const id = parseDimension(idText);
    if (od && wall && wall < od / 2 && (!id || same(id, rounded(od - 2 * wall)))) {
      dimensions.od = displayInches(od); dimensions.wall = displayInches(wall);
      dimensions.id = displayInches(rounded(od - 2 * wall));
      if (!odText || !wallText) reasons.push('Round-tube OD/wall came from legacy width/thickness fields and requires review');
      else evidence.push('Round-tube OD/wall explicitly stated in material text');
    } else { profile = null; reasons.push('Tube dimensions are missing, invalid, or conflicting'); }
  } else if (facts.rectangularTube) {
    profile = 'rectangular_tube';
    const dimensionToken = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)';
    const stated = facts.text.match(new RegExp(`${dimensionToken}\\s*[X×]\\s*${dimensionToken}\\s*[X×]\\s*${dimensionToken}`));
    const tubeWidth = parseDimension(stated?.[1]); const tubeHeight = parseDimension(stated?.[2]); const wall = parseDimension(stated?.[3]);
    if (tubeWidth && tubeHeight && wall && wall < Math.min(tubeWidth, tubeHeight) / 2) {
      dimensions.width = displayInches(tubeWidth); dimensions.height = displayInches(tubeHeight); dimensions.wall = displayInches(wall);
      evidence.push('Rectangular tube geometry explicitly stated in material text');
    } else reasons.push('Rectangular tube geometry is incomplete or invalid');
  } else if (facts.explicitRound && width && (!thickness || same(width, thickness))) {
    profile = 'solid_round'; dimensions.diameter = displayInches(width);
    evidence.push('Round profile explicitly stated in material text');
  } else if (facts.explicitFlat && width && thickness) {
    profile = 'flat_bar'; dimensions.width = displayInches(width); dimensions.thickness = displayInches(thickness);
    evidence.push('Flat-bar profile explicitly stated in material text');
  } else if (width && thickness) {
    dimensions.width = displayInches(width); dimensions.thickness = displayInches(thickness);
    reasons.push('Stock profile is not explicitly identified');
  } else {
    reasons.push('Cross-section dimensions are incomplete');
  }
  if (facts.process !== 'DOM' && !facts.roundTube && stockTokens.length >= 3 && width && thickness &&
      ((stockTokens[0] && !same(stockTokens[0], thickness)) || (stockTokens[1] && !same(stockTokens[1], width)))) reasons.push('Stock-size cross-section conflicts with structured width/thickness');
  if (!facts.grade) reasons.push('Material grade is unknown');
  if (!facts.condition && facts.process !== 'DOM') reasons.push('Material condition is unknown');

  const cut = parseDimension(row.cutLength);
  const finished = parseDimension(row.finalPartLength);
  const stockLength = stockTokens.length >= 3 ? stockTokens[stockTokens.length - 1] : null;
  let totalCutLength: number | null = cut ? rounded(cut * row.quantity) : null;
  let lengthNote = cut ? 'Cut length per piece multiplied by quantity.' : 'Cut length is missing.';
  if (cut && finished && cut + EPSILON < finished) {
    totalCutLength = null; lengthNote = 'Cut length is shorter than finished length.';
    reasons.push('Cut length is shorter than finished length');
  }
  if (stockLength && cut && !(finished && cut + EPSILON < finished)) {
    const calculated = rounded(cut * row.quantity);
    if (same(stockLength, calculated)) {
      totalCutLength = stockLength; lengthNote = 'Existing stock total agrees with cut length × quantity.';
    } else if (same(stockLength, cut)) {
      totalCutLength = calculated; lengthNote = 'Stock size contains a per-piece length; cut length × quantity used.';
    } else {
      totalCutLength = null; lengthNote = 'Existing stock length conflicts with cut length × quantity.';
      reasons.push('Stock total conflicts with cut length and quantity');
    }
  }
  const totalFinishedLength = finished ? rounded(finished * row.quantity) : null;

  const dimsKey = Object.entries(dimensions).sort().map(([key, value]) => `${key}:${value}`).join('|');
  const baseKey = `${facts.grade ?? '?'}|${facts.specification ?? '?'}|${facts.condition ?? '?'}|${profile ?? '?'}|${dimsKey}`;
  const exactKey = facts.grade && (facts.condition || facts.specification) && profile && dimsKey && reasons.length === 0 ? baseKey : null;
  const possibleKey = dimsKey && (facts.grade || facts.specification) ? baseKey : null;
  return {
    id: row.id, orderId: row.orderId, orderNumber: row.orderNumber, customerId: row.customerId,
    customerName: row.customerName ?? null, partNumber: row.partNumber, partName: row.partName ?? null,
    quantity: row.quantity, stockSize: clean(row.stockSize), cutLength: clean(row.cutLength),
    finalPartLength: clean(row.finalPartLength), dueDate: new Date(row.dueDate).toISOString(),
    href: `/orders/${row.orderId}?part=${row.id}`, materialRaw: facts.raw,
    vendorId: row.procurementVendorId ?? null, vendorName: row.procurementVendorName ?? null,
    normalized: { version: 1, grade: facts.grade, specification: facts.specification,
      condition: facts.condition, profile, dimensions, unit: 'in', evidence },
    totalFinishedLength, totalCutLength, lengthNote, reasons: [...new Set(reasons)].sort(), exactKey, possibleKey,
  };
}

function makeGroup(members: ProcurementGroupMember[], status: 'compatible' | 'needs_review', key: string): ProcurementGroup {
  const first = members[0];
  const reasons = [...new Set(members.flatMap(member => member.reasons))].sort();
  const finishedKnown = members.every(member => member.totalFinishedLength !== null);
  const cutKnown = members.every(member => member.totalCutLength !== null);
  return {
    id: `${status}:${key}`, material: [first.normalized.grade, first.normalized.specification,
      first.normalized.condition?.replace('_', ' ')].filter(Boolean).join(' ') || 'Unknown material',
    stock: [first.normalized.profile?.replaceAll('_', ' '), ...Object.entries(first.normalized.dimensions).map(([k, v]) => `${k} ${v}`)].filter(Boolean).join(', '),
    status, reasons, orderCount: new Set(members.map(member => member.orderId)).size,
    partCount: members.length, quantity: members.reduce((sum, member) => sum + member.quantity, 0),
    totalFinishedLength: finishedKnown ? rounded(members.reduce((sum, member) => sum + member.totalFinishedLength!, 0)) : null,
    totalCutLength: cutKnown ? rounded(members.reduce((sum, member) => sum + member.totalCutLength!, 0)) : null,
    lengthNote: cutKnown ? 'Sum of recorded cut lengths; no additional allowance has been added.' : 'One or more member lengths are incomplete or conflicting.',
    members,
  };
}

export function groupProcurementParts(rows: ProcurementPartRow[], filters: ProcurementFilters = {}): ProcurementGroupingResult {
  const started = performance.now();
  const now = filters.asOf ?? new Date();
  const terminalPartStatuses = ['COMPLETE', 'COMPLETED', 'CLOSED', 'CANCELLED', 'CANCELED', 'SHIPPED'];
  const terminalOrderStatuses = ['COMPLETE', 'COMPLETED', 'CLOSED', 'CANCELLED', 'CANCELED', 'SHIPPED'];
  const filtered = rows.filter(row => (row.materialStatus === 'NEED_TO_ORDER' || row.materialStatus === 'UNREVIEWED') &&
    !terminalPartStatuses.includes(row.partStatus ?? '') && !terminalOrderStatuses.includes(row.orderStatus ?? '')).filter(row => {
    if (filters.overdue && new Date(row.dueDate) >= now) return false;
    if (filters.customerId && row.customerId !== filters.customerId) return false;
    if (filters.customer && !(row.customerName ?? '').toLowerCase().includes(filters.customer.toLowerCase())) return false;
    if (filters.vendorId && row.procurementVendorId !== filters.vendorId) return false;
    if (filters.vendor && !(row.procurementVendorName ?? '').toLowerCase().includes(filters.vendor.toLowerCase())) return false;
    if (filters.material) {
      const haystack = `${row.materialName ?? ''} ${row.drawingMaterialText ?? ''}`.toLowerCase();
      if (!haystack.includes(filters.material.toLowerCase())) return false;
    }
    return true;
  });
  const eligible = filtered.filter(row => row.materialStatus === 'NEED_TO_ORDER');
  const normalized = eligible.map(normalize);
  const buckets = new Map<string, typeof normalized>();
  for (const member of normalized) {
    const key = member.exactKey ?? member.possibleKey;
    if (key) buckets.set(key, [...(buckets.get(key) ?? []), member]);
  }
  const groupedIds = new Set<string>();
  const groups: ProcurementGroup[] = [];
  for (const [key, bucket] of buckets) {
    if (new Set(bucket.map(member => member.orderId)).size < 2) continue;
    bucket.forEach(member => groupedIds.add(member.id));
    groups.push(makeGroup(bucket, bucket.every(member => member.exactKey !== null) ? 'compatible' : 'needs_review', key));
  }
  groups.sort((a, b) => a.status.localeCompare(b.status) || a.material.localeCompare(b.material) || a.stock.localeCompare(b.stock) || a.id.localeCompare(b.id));
  const ungrouped = normalized.filter(member => !groupedIds.has(member.id)).map(member => ({
    id: member.id, orderId: member.orderId, orderNumber: member.orderNumber, partNumber: member.partNumber,
    reason: member.possibleKey || member.exactKey ? 'No compatible part on another active order.' : member.reasons.join('; ') || 'Insufficient compatibility evidence.',
  }));
  return { groups, eligibleParts: eligible.length, eligibleOrders: new Set(eligible.map(row => row.orderId)).size,
    unreviewedParts: filtered.filter(row => row.materialStatus === 'UNREVIEWED').length, ungrouped,
    timings: { queryMs: 0, groupingMs: rounded(performance.now() - started) } };
}

export async function findProcurementGroups(filters: ProcurementFilters = {}): Promise<ProcurementGroupingResult> {
  const queryStarted = performance.now();
  const rows = await listProcurementParts(filters);
  const queryMs = rounded(performance.now() - queryStarted);
  const result = groupProcurementParts(rows, filters);
  return { ...result, timings: { ...result.timings, queryMs } };
}
