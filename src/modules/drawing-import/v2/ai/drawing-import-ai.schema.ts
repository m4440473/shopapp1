import { z } from 'zod';

import { MANUFACTURING_NOTE_CATEGORIES } from '../drawing-import-v2.types';

const nullableDiagnosticConfidence = z.number().min(0).max(1).nullable();
const modelFieldStatus = z.enum(['read', 'not_present', 'unreadable', 'conflicting']);

function fieldSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    rawText: z.string().nullable(),
    status: modelFieldStatus,
    evidenceText: z.string().nullable(),
    sourceRegionIdentity: z.string().nullable(),
    warnings: z.array(z.string()),
    diagnosticConfidence: nullableDiagnosticConfidence,
  }).strict();
}

export const DrawingImportAiTextField = fieldSchema(z.string());
export const DrawingImportAiQuantityField = fieldSchema(z.number().int().positive());
export const DrawingImportAiAssemblyField = fieldSchema(z.boolean());

export const DrawingImportAiCompactExtraction = z.object({
  partNumber: z.string().nullable(),
  description: z.string().nullable(),
  revision: z.string().nullable(),
  drawingQuantity: z.number().int().positive().nullable(),
  material: z.string().nullable(),
  finish: z.string().nullable(),
  finalLength: z.number().nonnegative().nullable(),
  partWidth: z.number().nonnegative().nullable(),
  partThickness: z.number().nonnegative().nullable(),
}).strict();

export const DrawingImportAiManufacturingNote = z.object({
  text: z.string().trim().min(1).max(2000),
  category: z.enum(MANUFACTURING_NOTE_CATEGORIES),
  evidenceText: z.string().trim().min(1).max(2000),
  sourceRegionIdentity: z.string().nullable(),
  warnings: z.array(z.string()),
  diagnosticConfidence: nullableDiagnosticConfidence,
}).strict();

export const DrawingImportAiExtraction = z.object({
  classification: z.enum([
    'part_drawing',
    'assembly_drawing',
    'bom',
    'cover_sheet',
    'reference',
    'duplicate',
    'uncertain',
  ]),
  classificationEvidenceText: z.string().nullable(),
  partNumber: DrawingImportAiTextField,
  partName: DrawingImportAiTextField,
  drawingQuantity: DrawingImportAiQuantityField,
  material: DrawingImportAiTextField,
  finish: DrawingImportAiTextField,
  stockSize: DrawingImportAiTextField,
  cutLength: DrawingImportAiTextField,
  finalLength: DrawingImportAiTextField,
  partWidth: DrawingImportAiTextField,
  partThickness: DrawingImportAiTextField,
  revision: DrawingImportAiTextField,
  assemblyStatus: DrawingImportAiAssemblyField,
  manufacturingNotes: z.array(DrawingImportAiManufacturingNote).max(30),
  contradictions: z.array(z.object({
    field: z.enum([
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
    ]),
    candidateValues: z.array(z.string()),
    explanation: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
}).strict();

export type DrawingImportAiExtraction = z.infer<typeof DrawingImportAiExtraction>;
export type DrawingImportAiCompactExtraction = z.infer<typeof DrawingImportAiCompactExtraction>;
export type DrawingImportAiModelFieldStatus = z.infer<typeof modelFieldStatus>;
