import type { DrawingImportAiExtraction, DrawingImportAiModelFieldStatus } from './drawing-import-ai.schema';

export const DRAWING_IMPORT_AI_CRITICAL_FIELDS = [
  'partNumber',
  'drawingQuantity',
  'material',
  'revision',
] as const;

export type DrawingImportSolEscalationInput = {
  terraResult: DrawingImportAiExtraction;
  solEscalationEnabled: boolean;
  contradictsStrongLocalEvidence: boolean;
  ambiguousBomMatches: boolean;
  poorOrUnusualPage: boolean;
};

export type DrawingImportSolEscalationDecision = {
  escalate: boolean;
  reasons: string[];
};

export function decideDrawingImportSolEscalation(
  input: DrawingImportSolEscalationInput,
): DrawingImportSolEscalationDecision {
  if (!input.solEscalationEnabled) return { escalate: false, reasons: [] };
  const reasons: string[] = [];
  for (const field of DRAWING_IMPORT_AI_CRITICAL_FIELDS) {
    const status = input.terraResult[field].status as DrawingImportAiModelFieldStatus;
    if (status === 'unreadable' || status === 'conflicting') reasons.push(`${field}:${status}`);
  }
  const dimensionFields = ['finalLength', 'partWidth', 'partThickness'] as const;
  for (const field of dimensionFields) {
    const status = input.terraResult[field].status as DrawingImportAiModelFieldStatus;
    if (status === 'unreadable' || status === 'conflicting') reasons.push(`${field}:${status}`);
  }
  if (input.contradictsStrongLocalEvidence) reasons.push('strong_local_evidence_contradiction');
  if (input.ambiguousBomMatches) reasons.push('ambiguous_bom_match');
  if (input.poorOrUnusualPage) reasons.push('poor_or_unusual_page');
  return { escalate: reasons.length > 0, reasons };
}
