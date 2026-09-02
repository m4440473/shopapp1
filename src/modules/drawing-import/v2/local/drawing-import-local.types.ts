import type { CoordinateAwarePageText } from '../document';
import type {
  DrawingImportFieldName,
  DrawingImportNormalizedRegion,
  DrawingImportPageClassification,
  DrawingImportPageExtraction,
} from '../drawing-import-v2.types';

export type DrawingTitleBlockProfileDefinition = {
  profileIdentifier: string;
  version: number;
  expectedAspectRatios: Array<{ minimum: number; maximum: number }>;
  orientations: Array<'portrait' | 'landscape'>;
  requiredAnchors: Array<{ label: string; aliases: string[]; expectedRegion?: DrawingImportNormalizedRegion }>;
  fieldRegions: Partial<Record<DrawingImportFieldName, DrawingImportNormalizedRegion>>;
  active: boolean;
};

export type DrawingTitleBlockProfileMatch = {
  matched: boolean;
  score: number;
  matchedAnchors: string[];
  missingAnchors: string[];
  warnings: string[];
};

export type DrawingLocalClassification = {
  classification: DrawingImportPageClassification;
  score: number;
  signals: string[];
};

export type DrawingLocalAnalysis = {
  text: CoordinateAwarePageText;
  classification: DrawingLocalClassification;
  extraction: DrawingImportPageExtraction;
  profileMatch: DrawingTitleBlockProfileMatch | null;
};
