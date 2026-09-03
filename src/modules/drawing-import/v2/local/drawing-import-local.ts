import path from 'node:path';

import type { CoordinateAwarePageText, ReconstructedTextLine } from '../document';
import {
  DRAWING_IMPORT_FIELD_NAMES,
  emptyDrawingField,
  type DrawingImportEvidence,
  type DrawingImportFieldName,
  type DrawingImportFieldValue,
  type DrawingImportPageClassification,
  type DrawingImportPageExtraction,
} from '../drawing-import-v2.types';
import type {
  DrawingLocalAnalysis,
  DrawingLocalClassification,
  DrawingTitleBlockProfileDefinition,
  DrawingTitleBlockProfileMatch,
} from './drawing-import-local.types';

export const DRAWING_IMPORT_LOCAL_PARSER_VERSION = 'drawing-local-v2.0.0';

const ANCHOR_PATTERNS: Record<Exclude<DrawingImportFieldName, 'assemblyStatus'>, RegExp[]> = {
  partNumber: [
    /\b(?:DWG|DRAWING)\s*(?:NO\.?|NUMBER|#)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9_.\/-]{2,})\b/i,
    /\bPART\s*(?:NO\.?|NUMBER|#)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9_.\/-]{2,})\b/i,
  ],
  partName: [
    /\b(?:PART\s*NAME|TITLE|DESCRIPTION)\s*[:#.-]?\s*(.{2,100})$/i,
  ],
  drawingQuantity: [
    /\b(?:DRAWING\s*)?(?:QTY|QUANTITY)\s*[:#.-]?\s*(\d{1,7})\b/i,
  ],
  material: [
    /\b(?:MATERIAL|MATL)\s*[:#.-]?\s*(.{2,100})$/i,
  ],
  finish: [
    /\b(?:FINISH|COATING|PLATING|PAINT|ANODIZE)\s*[:#.-]?\s*(.{2,100})$/i,
  ],
  stockSize: [
    /\b(?:STOCK\s*(?:SIZE|MATERIAL)|RAW\s*(?:SIZE|MATERIAL))\s*[:#.-]?\s*(.{2,100})$/i,
  ],
  cutLength: [
    /\bCUT\s*(?:LENGTH|LEN)\s*[:#.-]?\s*([0-9 .\/″"'-]+(?:MM|IN(?:CH(?:ES)?)?)?)\b/i,
  ],
  finalLength: [
    /\b(?:FINAL|FINISHED|OVERALL)\s*(?:LENGTH|LEN)\s*[:#.-]?\s*([0-9 .\/″"'-]+(?:MM|IN(?:CH(?:ES)?)?)?)\b/i,
  ],
  partWidth: [],
  partThickness: [],
  revision: [
    /\b(?:REVISION|REV)\s*[:#.-]?\s*([A-Z0-9]{1,6})\b/i,
  ],
};

const FIELD_LABELS = Object.values(ANCHOR_PATTERNS).flat();

export function normalizeDrawingText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[–—−]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00bd/g, '1/2')
    .replace(/\u00bc/g, '1/4')
    .replace(/\u00be/g, '3/4')
    .replace(/\s+/g, ' ')
    .trim();
}

function evidence(pageId: string, line: ReconstructedTextLine, agreementSignals: string[] = []): DrawingImportEvidence {
  return {
    sourceType: 'embedded_text',
    sourcePageId: pageId,
    sourceRegion: line.region,
    sourceCropId: null,
    rawText: line.text,
    parser: DRAWING_IMPORT_LOCAL_PARSER_VERSION,
    agreementSignals,
    warnings: [],
  };
}

function parsedField<T extends string | number | boolean>(
  value: T,
  rawText: string,
  sourceEvidence: DrawingImportEvidence,
): DrawingImportFieldValue<T> {
  return {
    value,
    rawText,
    status: 'read',
    evidence: [sourceEvidence],
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}

function parseTextField(
  pageId: string,
  lines: ReconstructedTextLine[],
  field: Exclude<DrawingImportFieldName, 'drawingQuantity' | 'assemblyStatus'>,
) {
  for (const line of [...lines].reverse()) {
    const normalized = normalizeDrawingText(line.text);
    for (const pattern of ANCHOR_PATTERNS[field]) {
      const match = normalized.match(pattern);
      const value = match?.[1]?.trim();
      if (value) return parsedField(value, match[0], evidence(pageId, line));
    }
  }
  return emptyDrawingField<string>();
}

function parseQuantityField(pageId: string, lines: ReconstructedTextLine[]) {
  for (const line of [...lines].reverse()) {
    const normalized = normalizeDrawingText(line.text);
    for (const pattern of ANCHOR_PATTERNS.drawingQuantity) {
      const match = normalized.match(pattern);
      const value = Number(match?.[1]);
      if (Number.isSafeInteger(value) && value > 0) return parsedField(value, match![0], evidence(pageId, line));
    }
  }
  return emptyDrawingField<number>();
}

function normalizedPartNumber(value: string | null | undefined) {
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? '';
}

function filenamePartNumber(filename: string) {
  return path.basename(filename, path.extname(filename));
}

function classificationScore(signals: Array<[DrawingImportPageClassification, number, string]>) {
  const totals = new Map<DrawingImportPageClassification, { score: number; signals: string[] }>();
  for (const [classification, amount, signal] of signals) {
    const current = totals.get(classification) ?? { score: 0, signals: [] };
    current.score += amount;
    current.signals.push(signal);
    totals.set(classification, current);
  }
  return [...totals.entries()].sort((left, right) => right[1].score - left[1].score)[0] ?? null;
}

export function classifyDrawingPage(page: CoordinateAwarePageText, filename: string): DrawingLocalClassification {
  const normalized = normalizeDrawingText(`${filename}\n${page.rawText}`).toUpperCase();
  const signals: Array<[DrawingImportPageClassification, number, string]> = [];
  if (/\b(?:BILL OF MATERIALS?|BOM|PARTS LIST)\b/.test(normalized)) signals.push(['bom', 5, 'bom-heading']);
  if (/\b(?:ITEM|FIND)\b/.test(normalized) && /\bQTY|QUANTITY\b/.test(normalized) && /\bDESCRIPTION\b/.test(normalized)) {
    signals.push(['bom', 4, 'bom-columns']);
  }
  if (/\b(?:COVER SHEET|DRAWING INDEX|TRANSMITTAL)\b/.test(normalized)) signals.push(['cover_sheet', 7, 'cover-heading']);
  if (/\b(?:REFERENCE ONLY|DO NOT MANUFACTURE|FOR REFERENCE)\b/.test(normalized)) signals.push(['reference', 6, 'reference-language']);
  if (/\b(?:ASSEMBLY|WELDMENT)\b/.test(normalized)) signals.push(['assembly_drawing', 3, 'assembly-language']);
  const anchoredFields = FIELD_LABELS.filter((pattern) => pattern.test(normalized)).length;
  if (anchoredFields >= 2) signals.push(['part_drawing', Math.min(6, anchoredFields * 2), 'title-block-anchors']);
  if (/\b(?:DWG|DRAWING)\s*(?:NO|NUMBER|#)\b/.test(normalized)) signals.push(['part_drawing', 4, 'drawing-number-anchor']);
  const winner = classificationScore(signals);
  if (!winner || winner[1].score < 4) return { classification: 'uncertain', score: winner?.[1].score ?? 0, signals: winner?.[1].signals ?? [] };
  if (
    winner[0] === 'bom' &&
    signals.some(([type]) => type === 'assembly_drawing') &&
    signals.some(([, , signal]) => signal === 'drawing-number-anchor')
  ) {
    return { classification: 'assembly_drawing', score: winner[1].score, signals: [...winner[1].signals, 'drawing-with-parts-list'] };
  }
  return { classification: winner[0], score: winner[1].score, signals: winner[1].signals };
}

function containsRegion(outer: readonly number[], inner: readonly number[]) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

export function matchTitleBlockProfile(
  page: CoordinateAwarePageText,
  profile: DrawingTitleBlockProfileDefinition,
): DrawingTitleBlockProfileMatch {
  const aspect = page.pageWidth / Math.max(1, page.pageHeight);
  const orientation = aspect >= 1 ? 'landscape' : 'portrait';
  const aspectMatches = profile.expectedAspectRatios.some((range) => aspect >= range.minimum && aspect <= range.maximum);
  const orientationMatches = profile.orientations.includes(orientation);
  const matchedAnchors: string[] = [];
  const missingAnchors: string[] = [];
  for (const anchor of profile.requiredAnchors) {
    const aliases = [anchor.label, ...anchor.aliases].map((value) => normalizeDrawingText(value).toUpperCase());
    const matched = page.lines.some((line) => {
      const text = normalizeDrawingText(line.text).toUpperCase();
      return aliases.some((alias) => text.includes(alias)) && (!anchor.expectedRegion || containsRegion(anchor.expectedRegion, line.region));
    });
    (matched ? matchedAnchors : missingAnchors).push(anchor.label);
  }
  const matched = profile.active && aspectMatches && orientationMatches && missingAnchors.length === 0;
  const anchorScore = profile.requiredAnchors.length ? matchedAnchors.length / profile.requiredAnchors.length : 0;
  return {
    matched,
    score: matched ? (0.4 + anchorScore * 0.6) : anchorScore * 0.5,
    matchedAnchors,
    missingAnchors,
    warnings: [
      ...(!profile.active ? ['profile-inactive'] : []),
      ...(!aspectMatches ? ['aspect-ratio-mismatch'] : []),
      ...(!orientationMatches ? ['orientation-mismatch'] : []),
      ...(missingAnchors.length ? ['required-anchors-missing'] : []),
    ],
  };
}

export function extractLocalDrawingFields(input: {
  pageId: string;
  filename: string;
  page: CoordinateAwarePageText;
  profile?: DrawingTitleBlockProfileDefinition | null;
}): DrawingLocalAnalysis {
  const classification = classifyDrawingPage(input.page, input.filename);
  const partNumber = parseTextField(input.pageId, input.page.lines, 'partNumber');
  const filenameValue = filenamePartNumber(input.filename);
  if (
    partNumber.value &&
    normalizedPartNumber(partNumber.value) === normalizedPartNumber(filenameValue) &&
    filenameValue.length >= 3
  ) {
    partNumber.evidence[0]?.agreementSignals.push('filename');
  }
  const profileMatch = input.profile ? matchTitleBlockProfile(input.page, input.profile) : null;
  const assemblyStatus = classification.classification === 'assembly_drawing'
    ? parsedField(true, 'Local page classification: assembly drawing', {
        sourceType: 'embedded_text',
        sourcePageId: input.pageId,
        sourceRegion: null,
        sourceCropId: null,
        rawText: null,
        parser: DRAWING_IMPORT_LOCAL_PARSER_VERSION,
        agreementSignals: classification.signals,
        warnings: [],
      })
    : emptyDrawingField<boolean>('not_present');

  const extraction: DrawingImportPageExtraction = {
    schemaVersion: 'drawing-page-extraction-v3',
    pageId: input.pageId,
    classification: classification.classification,
    classificationEvidence: [],
    partNumber,
    partName: parseTextField(input.pageId, input.page.lines, 'partName'),
    drawingQuantity: parseQuantityField(input.pageId, input.page.lines),
    material: parseTextField(input.pageId, input.page.lines, 'material'),
    finish: parseTextField(input.pageId, input.page.lines, 'finish'),
    stockSize: parseTextField(input.pageId, input.page.lines, 'stockSize'),
    cutLength: parseTextField(input.pageId, input.page.lines, 'cutLength'),
    finalLength: parseTextField(input.pageId, input.page.lines, 'finalLength'),
    // Full drawing geometry is resolved by V3's canonical-page PDF request.
    // Avoid guessing these from isolated local dimension spans.
    partWidth: emptyDrawingField<string>('not_present'),
    partThickness: emptyDrawingField<string>('not_present'),
    revision: parseTextField(input.pageId, input.page.lines, 'revision'),
    assemblyStatus,
    route: 'local',
    autoAcceptedFields: [],
    warnings: profileMatch?.warnings ?? [],
  };
  return { text: input.page, classification, extraction, profileMatch };
}

export function locallyAcceptableFields(
  extraction: DrawingImportPageExtraction,
  options: { enabled: boolean; profileMatched: boolean; bomAgreementFields?: ReadonlySet<DrawingImportFieldName> },
) {
  if (!options.enabled) return [];
  const accepted: DrawingImportFieldName[] = [];
  for (const name of DRAWING_IMPORT_FIELD_NAMES) {
    const field = extraction[name];
    if (field.status !== 'read' || field.value === null || field.evidence.length === 0 || field.candidates.length > 1) continue;
    const signals = new Set(field.evidence.flatMap((entry) => entry.agreementSignals));
    const anchored = field.evidence.some((entry) => entry.sourceRegion !== null && entry.rawText);
    const bomAgreement = options.bomAgreementFields?.has(name) ?? false;
    if (name === 'partNumber' && anchored && (signals.has('filename') || bomAgreement || options.profileMatched)) accepted.push(name);
    else if (name === 'drawingQuantity' && anchored && bomAgreement) accepted.push(name);
    else if ((name === 'revision' || name === 'material') && anchored && (bomAgreement || options.profileMatched)) accepted.push(name);
    else if (!['partNumber', 'drawingQuantity', 'revision', 'material'].includes(name) && anchored && options.profileMatched) accepted.push(name);
  }
  return accepted;
}
