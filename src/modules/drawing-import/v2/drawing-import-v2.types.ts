export const DRAWING_IMPORT_V3_PIPELINE_VERSION = 'drawing-import-v3.0.0';
/** Compatibility name retained while V3 reuses the durable V2 job framework. */
export const DRAWING_IMPORT_V2_PIPELINE_VERSION = DRAWING_IMPORT_V3_PIPELINE_VERSION;

export const DRAWING_IMPORT_FIELD_NAMES = [
  'partNumber',
  'partName',
  'drawingQuantity',
  'material',
  'finish',
  'stockSize',
  'cutLength',
  'finalLength',
  'partWidth',
  'partThickness',
  'revision',
  'assemblyStatus',
] as const;

export type DrawingImportFieldName = (typeof DRAWING_IMPORT_FIELD_NAMES)[number];

export type DrawingImportFieldStatus =
  | 'read'
  | 'not_present'
  | 'unreadable'
  | 'conflicting'
  | 'derived_from_bom'
  | 'derived_locally'
  | 'tentative_filename_fallback'
  | 'human_corrected';

export type DrawingImportEvidenceSource =
  | 'embedded_text'
  | 'ocr'
  | 'filename'
  | 'title_profile'
  | 'bom'
  | 'model_targeted'
  | 'model_full_page'
  | 'model_escalation'
  | 'human';

export type DrawingImportNormalizedRegion = readonly [number, number, number, number];

export type DrawingImportEvidence = {
  sourceType: DrawingImportEvidenceSource;
  sourcePageId: string;
  sourceRegion: DrawingImportNormalizedRegion | null;
  sourceCropId: string | null;
  rawText: string | null;
  parser: string;
  agreementSignals: string[];
  warnings: string[];
  derivedFrom?: Array<{ field: DrawingImportFieldName | 'quantityPerParent' | 'rootMultiplier'; value: string }>;
};

export const MANUFACTURING_NOTE_CATEGORIES = [
  'preheat_heat_treat',
  'welding',
  'inspection',
  'handling',
  'coating_finish',
  'other',
] as const;

export type ManufacturingDrawingNoteCategory = (typeof MANUFACTURING_NOTE_CATEGORIES)[number];

export type ManufacturingDrawingNote = {
  text: string;
  category: ManufacturingDrawingNoteCategory;
  evidence: DrawingImportEvidence[];
  warnings: string[];
  diagnosticConfidence: number | null;
};

export type DrawingImportFieldValue<T extends string | number | boolean> = {
  value: T | null;
  rawText: string | null;
  status: DrawingImportFieldStatus;
  evidence: DrawingImportEvidence[];
  candidates: Array<{
    value: T;
    sourceType: DrawingImportEvidenceSource;
    sourcePageId: string;
    sourceRegion: DrawingImportNormalizedRegion | null;
    rawText: string | null;
  }>;
  warnings: string[];
  diagnosticConfidence: number | null;
};

export type DrawingImportPageClassification =
  | 'part_drawing'
  | 'assembly_drawing'
  | 'bom'
  | 'cover_sheet'
  | 'reference'
  | 'duplicate'
  | 'uncertain';

export type DrawingImportRouteTier =
  | 'local'
  | 'terra_targeted'
  | 'terra_full_page'
  | 'terra_refinement'
  | 'sol_escalation'
  | 'human';

export type DrawingImportPageExtraction = {
  schemaVersion: 'drawing-page-extraction-v2' | 'drawing-page-extraction-v3' | 'drawing-page-extraction-v4';
  pageId: string;
  classification: DrawingImportPageClassification;
  classificationEvidence: DrawingImportEvidence[];
  partNumber: DrawingImportFieldValue<string>;
  partName: DrawingImportFieldValue<string>;
  drawingQuantity: DrawingImportFieldValue<number>;
  material: DrawingImportFieldValue<string>;
  finish: DrawingImportFieldValue<string>;
  stockSize: DrawingImportFieldValue<string>;
  cutLength: DrawingImportFieldValue<string>;
  finalLength: DrawingImportFieldValue<string>;
  partWidth: DrawingImportFieldValue<string>;
  partThickness: DrawingImportFieldValue<string>;
  revision: DrawingImportFieldValue<string>;
  assemblyStatus: DrawingImportFieldValue<boolean>;
  /** Exact, evidence-backed drawing text. It is never applied to a part without a human action. */
  manufacturingNotes?: ManufacturingDrawingNote[];
  route: DrawingImportRouteTier;
  autoAcceptedFields: DrawingImportFieldName[];
  warnings: string[];
};

export type DrawingImportJobStage =
  | 'queued'
  | 'inventory'
  | 'document_analysis'
  | 'bom_analysis'
  | 'local_resolution'
  | 'ai_resolution'
  | 'final_validation'
  | 'ready_for_review'
  | 'saving'
  | 'complete';

export type DrawingImportJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'COMPLETE';

export type DrawingImportJobProgress = {
  jobId: string;
  status: DrawingImportJobStatus;
  stage: DrawingImportJobStage;
  totalPages: number;
  completedPages: number;
  locallyAcceptedPages: number;
  terraProcessedPages: number;
  solEscalatedPages: number;
  manualReviewPages: number;
  failedPages: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  elapsedMs: number;
  firstPageReadyAt: string | null;
  errorSummary: string | null;
};

export type DrawingImportUsage = {
  route: DrawingImportRouteTier;
  requestedModel: string | null;
  resolvedModel: string | null;
  reasoningEffort: string | null;
  serviceTier: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number | null;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  calculatedCostUsd: number;
  latencyMs: number;
  retryCount: number;
  status: 'completed' | 'unresolved' | 'refused' | 'failed' | 'budget_stopped';
  responseId: string | null;
};

export type DrawingImportV2Mode = 'disabled' | 'shadow' | 'admin_beta' | 'default';

export type DrawingImportV2Config = {
  mode: DrawingImportV2Mode;
  localAutoAcceptEnabled: boolean;
  ocrEnabled: boolean;
  customerProfilesEnabled: boolean;
  solEscalationEnabled: boolean;
  lunaExperimentalEnabled: boolean;
  directPdfV3Enabled: boolean;
  pdfWorkerConcurrency: number;
  ocrWorkerConcurrency: number;
  targetedAiConcurrency: number;
  fullPageAiConcurrency: number;
  solAiConcurrency: number;
  softBudgetUsd: number;
  hardBudgetUsd: number;
  perRequestTimeoutMs: number;
  retryLimit: number;
};

export function normalizeDrawingImportPageExtraction(
  extraction: DrawingImportPageExtraction,
): DrawingImportPageExtraction {
  const candidate = extraction as DrawingImportPageExtraction & {
    partWidth?: DrawingImportFieldValue<string>;
    partThickness?: DrawingImportFieldValue<string>;
  };
  return {
    ...candidate,
    schemaVersion: 'drawing-page-extraction-v4',
    partWidth: candidate.partWidth ?? emptyDrawingField<string>('not_present'),
    partThickness: candidate.partThickness ?? emptyDrawingField<string>('not_present'),
    manufacturingNotes: Array.isArray(candidate.manufacturingNotes) ? candidate.manufacturingNotes : [],
  };
}

export function emptyDrawingField<T extends string | number | boolean>(
  status: Extract<DrawingImportFieldStatus, 'not_present' | 'unreadable'> = 'not_present',
): DrawingImportFieldValue<T> {
  return {
    value: null,
    rawText: null,
    status,
    evidence: [],
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}
