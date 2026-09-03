import { describe, expect, it } from 'vitest';

import { getDrawingImportV2Config, shouldDrawingImportV2AffectSavedResults } from '../drawing-import-v2.config';

describe('Drawing Import V2 configuration', () => {
  it('is disabled and conservative by default', () => {
    const config = getDrawingImportV2Config({});
    expect(config.mode).toBe('disabled');
    expect(config.localAutoAcceptEnabled).toBe(false);
    expect(config.ocrEnabled).toBe(false);
    expect(config.solEscalationEnabled).toBe(false);
    expect(config.fullPageAiConcurrency).toBe(2);
    expect(config.hardBudgetUsd).toBe(8);
    expect(shouldDrawingImportV2AffectSavedResults(config)).toBe(false);
  });

  it('bounds unsafe configuration and never lets the soft cap exceed the hard cap', () => {
    const config = getDrawingImportV2Config({
      DRAWING_IMPORT_V2_MODE: 'shadow',
      DRAWING_IMPORT_V2_PDF_CONCURRENCY: '99',
      DRAWING_IMPORT_V2_TARGETED_CONCURRENCY: '0',
      DRAWING_IMPORT_V2_SOFT_BUDGET_USD: '9',
      DRAWING_IMPORT_V2_HARD_BUDGET_USD: '3',
    });
    expect(config.mode).toBe('shadow');
    expect(config.pdfWorkerConcurrency).toBe(4);
    expect(config.targetedAiConcurrency).toBe(1);
    expect(config.softBudgetUsd).toBe(9);
    expect(config.hardBudgetUsd).toBe(9);
  });
});
