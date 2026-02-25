import { z } from 'zod';

function sanitizeNumericString(value: string): string {
  const withoutKnownPrintTokens = value
    .trim()
    .replace(/,/g, '')
    .replace(/[Ø⌀]/g, '')
    .replace(/\b(?:in|mm)\b/gi, '')
    .replace(/^[Rr]/, '')
    .replace(/\s+/g, '');

  return withoutKnownPrintTokens.replace(/[^0-9.+-]/g, '');
}

function preprocessNumeric(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = sanitizeNumericString(value);
  return cleaned.length > 0 ? cleaned : value;
}

const coercedNumberSchema = z.preprocess(preprocessNumeric, z.coerce.number());
const optionalCoercedNumberSchema = z.preprocess(preprocessNumeric, z.coerce.number().optional());

const countSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return 1;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/-?\d+/);
    if (match) return Number.parseInt(match[0], 10);
  }
  return value;
}, z.coerce.number().int().min(0));

const confidenceSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') return 0.6;
    return preprocessNumeric(value);
  }, z.coerce.number())
  .transform((value) => Math.min(1, Math.max(0, value)));

const holeToleranceSchema = z
  .object({
    plus: optionalCoercedNumberSchema,
    minus: optionalCoercedNumberSchema,
    fit: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .optional();

const radiusToleranceSchema = z
  .object({
    plus: optionalCoercedNumberSchema,
    minus: optionalCoercedNumberSchema,
    note: z.string().min(1).optional(),
  })
  .optional();

const recommendedTapDrillSchema = z
  .object({
    drill: z.string().min(1),
    diameter: optionalCoercedNumberSchema,
    basis: z.string().min(1).optional(),
  })
  .optional();

export const printAnalyzerResultSchema = z.object({
  units: z.enum(['inch', 'mm', 'unknown']),
  holes: z
    .array(
      z.object({
        diameter: coercedNumberSchema,
        count: countSchema,
        notes: z.string().min(1).optional(),
        tolerance: holeToleranceSchema,
        confidence: confidenceSchema,
      })
    )
    .default([]),
  radii: z
    .array(
      z.object({
        radius: coercedNumberSchema,
        count: countSchema,
        notes: z.string().min(1).optional(),
        tolerance: radiusToleranceSchema,
        confidence: confidenceSchema,
      })
    )
    .default([]),
  generalTolerances: z
    .array(
      z.object({
        note: z.string().min(1),
        confidence: confidenceSchema,
      })
    )
    .default([]),
  tappedHoles: z
    .array(
      z.object({
        thread: z.string().min(1),
        count: countSchema,
        classOrFit: z.string().min(1).optional(),
        calloutNotes: z.string().min(1).optional(),
        recommendedTapDrill: recommendedTapDrillSchema,
        confidence: confidenceSchema,
      })
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
});

export type PrintAnalyzerResult = z.infer<typeof printAnalyzerResultSchema>;
