import { z } from 'zod';

export const DrawingImportField = z.object({
  value: z.string().trim().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().max(500).nullable().default(null),
});

export const DrawingImportQuantityField = z.object({
  value: z.number().int().min(1).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().max(500).nullable().default(null),
});

export const DrawingTitleBlockResult = z.object({
  partNumber: DrawingImportField,
  partName: DrawingImportField,
  quantity: DrawingImportQuantityField,
  material: DrawingImportField,
  finish: DrawingImportField.default({ value: null, confidence: 0, evidence: null }),
  stockSize: DrawingImportField,
  cutLength: DrawingImportField,
  revision: DrawingImportField,
  isAssembly: z.preprocess(
    (value) => value && typeof value === 'object' && 'value' in value ? (value as { value?: unknown }).value : value,
    z.boolean().default(false),
  ),
  warnings: z.preprocess(
    (value) => {
      const unwrapped = value && typeof value === 'object' && 'value' in value ? (value as { value?: unknown }).value : value;
      if (unwrapped === null || unwrapped === undefined || unwrapped === '') return [];
      return typeof unwrapped === 'string' ? [unwrapped] : unwrapped;
    },
    z.array(z.string().trim().max(500)).default([]),
  ),
});

export type DrawingTitleBlockResult = z.infer<typeof DrawingTitleBlockResult>;

export const DRAWING_IMPORT_SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'] as const;

export type DrawingImportProposal = DrawingTitleBlockResult & {
  key: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  pageCount: number | null;
};
