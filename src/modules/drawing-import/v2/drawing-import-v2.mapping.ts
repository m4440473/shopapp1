import {
  DRAWING_IMPORT_FIELD_NAMES,
  type DrawingImportEvidenceSource,
  type DrawingImportFieldName,
  type DrawingImportFieldValue,
  type ManufacturingDrawingNote,
  type DrawingImportPageExtraction,
  type DrawingImportRouteTier,
} from './drawing-import-v2.types';
import type { CoordinateAwarePageText } from './document';
import type { DrawingImportAiExtraction } from './ai/drawing-import-ai.schema';

type AiField = DrawingImportAiExtraction[DrawingImportFieldName];

function sourceType(route: DrawingImportRouteTier): DrawingImportEvidenceSource {
  if (route === 'terra_targeted') return 'model_targeted';
  if (route === 'terra_full_page' || route === 'terra_refinement') return 'model_full_page';
  return 'model_escalation';
}

function normalized(value: string | null | undefined) {
  return value?.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase() ?? '';
}

function normalizeFinish(field: DrawingImportFieldValue<string>): DrawingImportFieldValue<string> {
  const value = normalized(field.value);
  const explicitNa = ['NA', 'N/A', 'NONE', 'NO FINISH', 'NOT APPLICABLE'].includes(value);
  if (!explicitNa && !(field.value === null && field.status === 'not_present')) return field;
  return {
    ...field,
    value: 'NA',
    rawText: explicitNa ? field.rawText ?? field.value : null,
    status: explicitNa ? 'read' : 'derived_locally',
    candidates: explicitNa ? field.candidates.map((candidate) => ({ ...candidate, value: 'NA' })) : [],
  };
}

function normalizePartNumber(field: DrawingImportFieldValue<string>): DrawingImportFieldValue<string> {
  const value = normalized(field.value).replace(/[.:#]+$/, '').trim();
  const fieldLabels = new Set(['REV', 'REVISION', 'DRAWING NUMBER', 'DRAWING NO', 'DWG NO', 'PART NUMBER', 'PART NO']);
  if (!fieldLabels.has(value)) return field;
  return {
    ...field,
    value: null,
    rawText: field.rawText,
    status: 'unreadable',
    candidates: [],
    warnings: [...field.warnings, 'Rejected a title-block field label that was returned without its identifier value.'],
  };
}

function matchingLocalRegion(page: CoordinateAwarePageText, evidenceText: string | null) {
  const needle = normalized(evidenceText);
  if (!needle) return null;
  return page.lines.find((line) => {
    const haystack = normalized(line.text);
    return haystack === needle || haystack.includes(needle) || needle.includes(haystack);
  })?.region ?? null;
}

function modelField<T extends string | number | boolean>(input: {
  field: AiField;
  pageId: string;
  page: CoordinateAwarePageText;
  route: Exclude<DrawingImportRouteTier, 'local' | 'human'>;
  cropId?: string | null;
  cropRegion?: readonly [number, number, number, number] | null;
}): DrawingImportFieldValue<T> {
  const value = input.field.value as T | null;
  const mappedRegion = matchingLocalRegion(input.page, input.field.evidenceText);
  const sourceRegion = mappedRegion ?? (input.field.sourceRegionIdentity === input.cropId ? input.cropRegion ?? null : null);
  const evidenceWarnings = sourceRegion ? [] : ['Model evidence could not be mapped to verified local coordinates.'];
  return {
    value,
    rawText: input.field.rawText,
    status: input.field.status,
    evidence: value === null && !input.field.evidenceText ? [] : [{
      sourceType: sourceType(input.route),
      sourcePageId: input.pageId,
      sourceRegion,
      sourceCropId: input.field.sourceRegionIdentity,
      rawText: input.field.evidenceText ?? input.field.rawText,
      parser: `drawing-import-ai-${input.route}`,
      agreementSignals: mappedRegion ? ['mapped_to_local_text'] : input.cropId && input.field.sourceRegionIdentity === input.cropId ? ['known_crop_region'] : [],
      warnings: evidenceWarnings,
    }],
    candidates: value === null ? [] : [{
      value,
      sourceType: sourceType(input.route),
      sourcePageId: input.pageId,
      sourceRegion,
      rawText: input.field.evidenceText ?? input.field.rawText,
    }],
    warnings: [...input.field.warnings, ...evidenceWarnings],
    diagnosticConfidence: input.field.diagnosticConfidence,
  };
}

function mergeField<T extends string | number | boolean>(
  local: DrawingImportFieldValue<T>,
  ai: DrawingImportFieldValue<T>,
  locallyAccepted: boolean,
  preferModel: boolean,
): DrawingImportFieldValue<T> {
  if (locallyAccepted) {
    if (ai.value !== null && normalized(String(ai.value)) !== normalized(String(local.value))) {
      return {
        ...local,
        candidates: [...local.candidates, ...ai.candidates],
        warnings: [...local.warnings, 'The model proposed a different value, but strong local evidence was retained.'],
      };
    }
    return { ...local, evidence: [...local.evidence, ...ai.evidence], warnings: [...local.warnings, ...ai.warnings] };
  }
  if (preferModel) {
    const differs = local.value !== null && ai.value !== null
      && normalized(String(local.value)) !== normalized(String(ai.value));
    return {
      ...ai,
      evidence: [...local.evidence, ...ai.evidence],
      candidates: differs && local.value !== null
        ? [
            { value: local.value, sourceType: local.evidence[0]?.sourceType ?? 'embedded_text', sourcePageId: local.evidence[0]?.sourcePageId ?? '', sourceRegion: local.evidence[0]?.sourceRegion ?? null, rawText: local.rawText },
            ...ai.candidates,
          ]
        : [...local.candidates, ...ai.candidates],
      warnings: [
        ...local.warnings,
        ...ai.warnings,
        ...(differs ? ['A weak local candidate differed from the full-page model read; the model value was retained for review.'] : []),
      ],
    };
  }
  if (local.value !== null && ai.value !== null && normalized(String(local.value)) !== normalized(String(ai.value))) {
    return {
      ...ai,
      status: 'conflicting',
      candidates: [
        ...local.candidates,
        { value: local.value, sourceType: local.evidence[0]?.sourceType ?? 'embedded_text', sourcePageId: local.evidence[0]?.sourcePageId ?? '', sourceRegion: local.evidence[0]?.sourceRegion ?? null, rawText: local.rawText },
        ...ai.candidates,
      ],
      evidence: [...local.evidence, ...ai.evidence],
      warnings: [...local.warnings, ...ai.warnings, 'Local and model values conflict.'],
    };
  }
  return ai.value !== null || ai.status !== 'not_present'
    ? { ...ai, evidence: [...local.evidence, ...ai.evidence], warnings: [...local.warnings, ...ai.warnings] }
    : local;
}

function modelManufacturingNotes(input: {
  ai: DrawingImportAiExtraction;
  pageId: string;
  page: CoordinateAwarePageText;
  route: Exclude<DrawingImportRouteTier, 'local' | 'human'>;
  cropId?: string | null;
  cropRegion?: readonly [number, number, number, number] | null;
}): ManufacturingDrawingNote[] {
  return input.ai.manufacturingNotes.map((note) => {
    const mappedRegion = matchingLocalRegion(input.page, note.evidenceText);
    const knownCrop = Boolean(input.cropId && note.sourceRegionIdentity === input.cropId);
    const sourceRegion = mappedRegion ?? (knownCrop ? input.cropRegion ?? null : null);
    const evidenceWarnings = sourceRegion ? [] : ['Note evidence is page-level only; verify it on the drawing before applying.'];
    return {
      text: note.text.trim(),
      category: note.category,
      evidence: [{
        sourceType: sourceType(input.route),
        sourcePageId: input.pageId,
        sourceRegion,
        sourceCropId: note.sourceRegionIdentity,
        rawText: note.evidenceText,
        parser: `drawing-import-ai-${input.route}`,
        agreementSignals: mappedRegion ? ['mapped_to_local_text'] : knownCrop ? ['known_crop_region'] : [],
        warnings: evidenceWarnings,
      }],
      warnings: [...note.warnings, ...evidenceWarnings],
      diagnosticConfidence: note.diagnosticConfidence,
    };
  });
}

function mergeManufacturingNotes(
  current: ManufacturingDrawingNote[],
  incoming: ManufacturingDrawingNote[],
) {
  const notes = new Map<string, ManufacturingDrawingNote>();
  for (const note of [...current, ...incoming]) {
    const key = note.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    if (!key) continue;
    const prior = notes.get(key);
    notes.set(key, prior
      ? { ...prior, evidence: [...prior.evidence, ...note.evidence], warnings: [...new Set([...prior.warnings, ...note.warnings])] }
      : note);
  }
  return [...notes.values()];
}

export function mergeDrawingImportAiExtraction(input: {
  local: DrawingImportPageExtraction;
  ai: DrawingImportAiExtraction;
  page: CoordinateAwarePageText;
  route: Exclude<DrawingImportRouteTier, 'local' | 'human'>;
  cropId?: string | null;
  cropRegion?: readonly [number, number, number, number] | null;
  preferModel?: boolean;
  fieldsToReplace?: readonly DrawingImportFieldName[];
}) {
  const output: DrawingImportPageExtraction = {
    ...input.local,
    classification: input.fieldsToReplace ? input.local.classification : input.ai.classification,
    route: input.route,
    warnings: [...input.local.warnings, ...input.ai.warnings, ...input.ai.contradictions.map((entry) => `${entry.field}: ${entry.explanation}`)],
  };
  for (const name of DRAWING_IMPORT_FIELD_NAMES) {
    if (input.fieldsToReplace && !input.fieldsToReplace.includes(name)) continue;
    const ai = modelField({
      field: input.ai[name],
      pageId: input.local.pageId,
      page: input.page,
      route: input.route,
      cropId: input.cropId,
      cropRegion: input.cropRegion,
    });
    (output[name] as DrawingImportFieldValue<string | number | boolean>) = mergeField(
      input.local[name] as DrawingImportFieldValue<string | number | boolean>,
      ai,
      input.local.autoAcceptedFields.includes(name),
      input.preferModel ?? false,
    );
  }
  if (!input.fieldsToReplace || input.fieldsToReplace.includes('partNumber')) output.partNumber = normalizePartNumber(output.partNumber);
  if (!input.fieldsToReplace || input.fieldsToReplace.includes('finish')) output.finish = normalizeFinish(output.finish);
  if (!input.fieldsToReplace) {
    output.manufacturingNotes = mergeManufacturingNotes(
      input.local.manufacturingNotes ?? [],
      modelManufacturingNotes({
        ai: input.ai,
        pageId: input.local.pageId,
        page: input.page,
        route: input.route,
        cropId: input.cropId,
        cropRegion: input.cropRegion,
      }),
    );
  } else {
    output.manufacturingNotes = input.local.manufacturingNotes ?? [];
  }
  return output;
}

export function drawingImportExtractionNeedsHumanReview(extraction: DrawingImportPageExtraction) {
  if (!['part_drawing', 'assembly_drawing'].includes(extraction.classification)) return false;
  const requiredFields: DrawingImportFieldName[] = ['partNumber', 'drawingQuantity', 'material'];
  if (extraction.classification === 'part_drawing') {
    requiredFields.push('finalLength', 'partWidth', 'partThickness');
  }
  return requiredFields.some((name) => {
    const field = extraction[name];
    return field.value === null || ['unreadable', 'conflicting', 'tentative_filename_fallback'].includes(field.status);
  });
}

export function canDrawingImportPageCreatePart(extraction: DrawingImportPageExtraction) {
  return ['part_drawing', 'assembly_drawing'].includes(extraction.classification);
}
