import type { DrawingImportV2Config, DrawingImportV2Mode } from './drawing-import-v2.types';

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function integerValue(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function moneyValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function modeValue(value: string | undefined): DrawingImportV2Mode {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'shadow' || normalized === 'admin_beta' || normalized === 'default' ? normalized : 'disabled';
}

export function getDrawingImportV2Config(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DrawingImportV2Config {
  const directPdfV3Enabled = booleanValue(environment.DRAWING_IMPORT_V3_ENABLED, false);
  const softBudgetUsd = moneyValue(environment.DRAWING_IMPORT_V2_SOFT_BUDGET_USD, 6.4);
  const hardBudgetUsd = Math.max(softBudgetUsd, moneyValue(environment.DRAWING_IMPORT_V2_HARD_BUDGET_USD, 8));
  return {
    mode: modeValue(environment.DRAWING_IMPORT_V2_MODE),
    localAutoAcceptEnabled: booleanValue(environment.DRAWING_IMPORT_V2_LOCAL_AUTO_ACCEPT, false),
    // The newer importer reads original PDF pages directly; local OCR is retired.
    ocrEnabled: false,
    customerProfilesEnabled: booleanValue(environment.DRAWING_IMPORT_V2_PROFILES, false),
    solEscalationEnabled: !directPdfV3Enabled && booleanValue(environment.DRAWING_IMPORT_V2_SOL, false),
    lunaExperimentalEnabled: booleanValue(environment.DRAWING_IMPORT_V2_LUNA, false),
    directPdfV3Enabled,
    pdfWorkerConcurrency: integerValue(environment.DRAWING_IMPORT_V2_PDF_CONCURRENCY, 1, 1, 4),
    ocrWorkerConcurrency: integerValue(environment.DRAWING_IMPORT_V2_OCR_CONCURRENCY, 1, 1, 4),
    targetedAiConcurrency: integerValue(environment.DRAWING_IMPORT_V2_TARGETED_CONCURRENCY, 8, 1, 16),
    fullPageAiConcurrency: integerValue(environment.DRAWING_IMPORT_V2_PDF_AI_CONCURRENCY, 2, 1, 8),
    solAiConcurrency: integerValue(environment.DRAWING_IMPORT_V2_SOL_CONCURRENCY, 1, 1, 4),
    softBudgetUsd,
    hardBudgetUsd,
    perRequestTimeoutMs: integerValue(environment.DRAWING_IMPORT_V2_TIMEOUT_MS, 90_000, 5_000, 300_000),
    // V3 performs one extraction per page; failures remain visible for manual retry.
    retryLimit: directPdfV3Enabled ? 0 : integerValue(environment.DRAWING_IMPORT_V2_RETRY_LIMIT, 3, 0, 5),
  };
}

export function isDrawingImportV2Available(config = getDrawingImportV2Config()) {
  return config.mode !== 'disabled';
}

export function shouldDrawingImportV2AffectSavedResults(config = getDrawingImportV2Config()) {
  return config.mode === 'admin_beta' || config.mode === 'default';
}
