import type { DrawingImportV2Config } from '../drawing-import-v2.types';

export type DrawingImportReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type DrawingImportAiSettings = {
  terraModel: string;
  terraReasoningEffort: DrawingImportReasoningEffort;
  terraRefinementReasoningEffort: DrawingImportReasoningEffort;
  solModel: string;
  solReasoningEffort: DrawingImportReasoningEffort;
  maxOutputTokens: number;
  estimatedOutputTokens: number;
  fallbackEstimatedCostPerRequestUsd: number;
};

const reasoningEfforts = new Set<DrawingImportReasoningEffort>([
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
]);

function effort(value: string | undefined, fallback: DrawingImportReasoningEffort) {
  const normalized = value?.trim().toLowerCase() as DrawingImportReasoningEffort | undefined;
  return normalized && reasoningEfforts.has(normalized) ? normalized : fallback;
}

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function money(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getDrawingImportAiSettings(
  environment: Record<string, string | undefined> = process.env,
): DrawingImportAiSettings {
  const v3Enabled = ['1', 'true', 'yes', 'on'].includes(
    environment.DRAWING_IMPORT_V3_ENABLED?.trim().toLowerCase() ?? '',
  );

  return {
    terraModel:
      environment.DRAWING_IMPORT_V2_TERRA_MODEL?.trim() ||
      'gpt-5.4-mini',

    terraReasoningEffort: effort(
      environment.DRAWING_IMPORT_V2_TERRA_REASONING,
      'medium',
    ),

    terraRefinementReasoningEffort: effort(
      environment.DRAWING_IMPORT_V3_TERRA_REFINEMENT_REASONING,
      'medium',
    ),

    solModel:
      environment.DRAWING_IMPORT_V2_LUNA_MODEL?.trim() ||
      environment.DRAWING_IMPORT_V2_SOL_MODEL?.trim() ||
      'gpt-5.6-luna',

    solReasoningEffort: effort(
      environment.DRAWING_IMPORT_V2_LUNA_REASONING ??
        environment.DRAWING_IMPORT_V2_SOL_REASONING,
      'high',
    ),

    maxOutputTokens: integer(
      environment.DRAWING_IMPORT_V2_MAX_OUTPUT_TOKENS,
      v3Enabled ? 10_000 : 4_000,
      256,
      16_384,
    ),

    estimatedOutputTokens: integer(
      environment.DRAWING_IMPORT_V2_ESTIMATED_OUTPUT_TOKENS,
      v3Enabled ? 2_500 : 1_500,
      128,
      8_192,
    ),

    fallbackEstimatedCostPerRequestUsd: money(
      environment.DRAWING_IMPORT_V2_FALLBACK_REQUEST_USD,
      0.08,
    ),
  };
}

export type DrawingImportAiRuntimeConfig = Pick<
  DrawingImportV2Config,
  | 'softBudgetUsd'
  | 'hardBudgetUsd'
  | 'perRequestTimeoutMs'
  | 'retryLimit'
  | 'solEscalationEnabled'
>;