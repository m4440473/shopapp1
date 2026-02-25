import { z } from 'zod';

const confidenceSchema = z.number().min(0).max(1);

const holeToleranceSchema = z
  .object({
    plus: z.number().optional(),
    minus: z.number().optional(),
    fit: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .optional();

const radiusToleranceSchema = z
  .object({
    plus: z.number().optional(),
    minus: z.number().optional(),
    note: z.string().min(1).optional(),
  })
  .optional();

const recommendedTapDrillSchema = z
  .object({
    drill: z.string().min(1),
    diameter: z.number().optional(),
    basis: z.string().min(1).optional(),
  })
  .optional();

export const printAnalyzerResultSchema = z.object({
  units: z.enum(['inch', 'mm', 'unknown']),
  holes: z.array(
    z.object({
      diameter: z.number(),
      count: z.number().int().min(1),
      notes: z.string().min(1).optional(),
      tolerance: holeToleranceSchema,
      confidence: confidenceSchema,
    })
  ),
  radii: z.array(
    z.object({
      radius: z.number(),
      count: z.number().int().min(1),
      notes: z.string().min(1).optional(),
      tolerance: radiusToleranceSchema,
      confidence: confidenceSchema,
    })
  ),
  generalTolerances: z.array(
    z.object({
      note: z.string().min(1),
      confidence: confidenceSchema,
    })
  ),
  tappedHoles: z.array(
    z.object({
      thread: z.string().min(1),
      count: z.number().int().min(1),
      classOrFit: z.string().min(1).optional(),
      calloutNotes: z.string().min(1).optional(),
      recommendedTapDrill: recommendedTapDrillSchema,
      confidence: confidenceSchema,
    })
  ),
  warnings: z.array(z.string()),
});

export type PrintAnalyzerResult = z.infer<typeof printAnalyzerResultSchema>;
