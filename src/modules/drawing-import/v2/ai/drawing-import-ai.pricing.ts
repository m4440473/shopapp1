export const DRAWING_IMPORT_AI_PRICING_SCHEMA_VERSION = 'drawing-import-pricing-v1';

export type DrawingImportModelPrice = {
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  cacheWriteUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

export type DrawingImportPricingCatalog = {
  schemaVersion: typeof DRAWING_IMPORT_AI_PRICING_SCHEMA_VERSION;
  pricingVersion: string;
  effectiveDate: string;
  models: Record<string, DrawingImportModelPrice>;
};

export type DrawingImportTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

/**
 * Centralized pricing snapshot used for import estimates and usage records.
 * Values are intentionally kept in one versioned object so a price change does
 * not silently rewrite the meaning of historical import-cost records.
 */
export const DEFAULT_DRAWING_IMPORT_PRICING_CATALOG: DrawingImportPricingCatalog = {
  schemaVersion: DRAWING_IMPORT_AI_PRICING_SCHEMA_VERSION,
  pricingVersion: 'openai-2026-09-01',
  effectiveDate: '2026-09-01',
  models: {
    'gpt-5.4-mini': {
      inputUsdPerMillionTokens: 0.75,
      cachedInputUsdPerMillionTokens: 0.075,
      cacheWriteUsdPerMillionTokens: 0.9375,
      outputUsdPerMillionTokens: 4.5,
    },
    'gpt-5.6-luna': {
      inputUsdPerMillionTokens: 0.2,
      cachedInputUsdPerMillionTokens: 0.02,
      cacheWriteUsdPerMillionTokens: 0.25,
      outputUsdPerMillionTokens: 1.2,
    },
    'gpt-5.6-terra': {
      inputUsdPerMillionTokens: 2,
      cachedInputUsdPerMillionTokens: 0.2,
      cacheWriteUsdPerMillionTokens: 2.5,
      outputUsdPerMillionTokens: 12,
    },
    'gpt-5.6-sol': {
      inputUsdPerMillionTokens: 4,
      cachedInputUsdPerMillionTokens: 0.4,
      cacheWriteUsdPerMillionTokens: 5,
      outputUsdPerMillionTokens: 20,
    },
  },
};

export function calculateDrawingImportCostUsd(
  model: string,
  usage: DrawingImportTokenUsage,
  catalog: DrawingImportPricingCatalog,
): number | null {
  const price = catalog.models[model];
  if (!price) return null;
  const cached = Math.min(usage.inputTokens, Math.max(0, usage.cachedInputTokens));
  const cacheWrite = Math.min(
    Math.max(0, usage.inputTokens - cached),
    Math.max(0, usage.cacheWriteTokens),
  );
  const uncached = Math.max(0, usage.inputTokens - cached - cacheWrite);
  const total = (
    uncached * price.inputUsdPerMillionTokens
    + cached * price.cachedInputUsdPerMillionTokens
    + cacheWrite * price.cacheWriteUsdPerMillionTokens
    + Math.max(0, usage.outputTokens) * price.outputUsdPerMillionTokens
  ) / 1_000_000;
  return Number(total.toFixed(6));
}

export class DrawingImportAiBudgetController {
  private reservedUsd = 0;
  private actualUsd = 0;
  private sequence = 0;
  private readonly reservations = new Map<string, number>();

  constructor(
    private readonly softBudgetUsd: number,
    private readonly hardBudgetUsd: number,
    initialActualUsd = 0,
  ) {
    this.actualUsd = Math.max(0, initialActualUsd);
  }

  reserve(estimatedCostUsd: number) {
    const estimate = Math.max(0, estimatedCostUsd);
    const projected = this.actualUsd + this.reservedUsd + estimate;
    if (projected > this.hardBudgetUsd) {
      return { allowed: false as const, softWarning: projected >= this.softBudgetUsd, projectedCostUsd: projected };
    }
    const reservationId = `budget-${++this.sequence}`;
    this.reservations.set(reservationId, estimate);
    this.reservedUsd += estimate;
    return {
      allowed: true as const,
      reservationId,
      softWarning: projected >= this.softBudgetUsd,
      projectedCostUsd: projected,
    };
  }

  settle(reservationId: string, actualCostUsd: number) {
    const reserved = this.reservations.get(reservationId);
    if (reserved === undefined) return;
    this.reservations.delete(reservationId);
    this.reservedUsd = Math.max(0, this.reservedUsd - reserved);
    this.actualUsd += Math.max(0, actualCostUsd);
  }

  release(reservationId: string) {
    this.settle(reservationId, 0);
  }

  snapshot() {
    return {
      actualCostUsd: Number(this.actualUsd.toFixed(6)),
      reservedCostUsd: Number(this.reservedUsd.toFixed(6)),
      projectedCostUsd: Number((this.actualUsd + this.reservedUsd).toFixed(6)),
      softBudgetUsd: this.softBudgetUsd,
      hardBudgetUsd: this.hardBudgetUsd,
    };
  }
}
