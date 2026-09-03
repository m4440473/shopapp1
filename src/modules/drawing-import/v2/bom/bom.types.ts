import type {
  DrawingImportEvidence,
  DrawingImportFieldValue,
  DrawingImportNormalizedRegion,
} from '../drawing-import-v2.types';

export type BomColumnName =
  | 'item'
  | 'partNumber'
  | 'description'
  | 'quantityPerParent'
  | 'material'
  | 'revision';

export type BomTextSpan = {
  id?: string;
  pageId: string;
  text: string;
  region: DrawingImportNormalizedRegion;
  readingOrder: number;
  rotation?: number;
};
export type DrawingBomRow = {
  id: string;
  sourcePageId: string;
  rowIndex: number;
  item: DrawingImportFieldValue<string>;
  partNumber: DrawingImportFieldValue<string>;
  description: DrawingImportFieldValue<string>;
  quantityPerParent: DrawingImportFieldValue<number>;
  material: DrawingImportFieldValue<string>;
  revision: DrawingImportFieldValue<string>;
  parentAssemblyPartNumber: DrawingImportFieldValue<string>;
  sourceRegion: DrawingImportNormalizedRegion;
  rawCells: Partial<Record<BomColumnName, string>>;
  warnings: string[];
};

export type BomTableReconstruction = {
  sourcePageId: string;
  headerRegion: DrawingImportNormalizedRegion | null;
  detectedColumns: Array<{ name: BomColumnName; centerX: number; label: string }>;
  rows: DrawingBomRow[];
  warnings: string[];
};

export type BomDrawingPageCandidate = {
  pageId: string;
  partNumber: DrawingImportFieldValue<string>;
  revision: DrawingImportFieldValue<string>;
  partName?: DrawingImportFieldValue<string>;
  filename?: string | null;
  itemReferences?: string[];
};

export type BomPageMatchCandidate = {
  pageId: string;
  score: number;
  signals: string[];
  revisionConflict: boolean;
};

export type BomPageMatch = {
  rowId: string;
  status: 'matched' | 'missing' | 'ambiguous' | 'revision_conflict' | 'invalid_part_number';
  matchedPageId: string | null;
  candidates: BomPageMatchCandidate[];
  warnings: string[];
};

export type AssemblyGraphNode = {
  id: string;
  pageId?: string | null;
  partNumber?: string | null;
  revision?: string | null;
};

export type AssemblyGraphEdge = {
  id: string;
  bomRowId: string;
  parentNodeId: string;
  childNodeId: string | null;
  quantityPerParent: number | null;
  sourcePageId: string;
  sourceRegion: DrawingImportNormalizedRegion | null;
  /** Stable identity of the source row. Repeated parsing of the same row must reuse it. */
  sourceFingerprint: string;
};

export type AssemblyRootRequest = {
  nodeId: string;
  quantity: number;
};

export type AssemblyQuantityOverride = {
  nodeId: string;
  quantity: number;
  evidence?: DrawingImportEvidence[];
};

export type OneOffQuantity = {
  nodeId: string;
  quantity: DrawingImportFieldValue<number>;
};

export type QuantityContribution = {
  rootNodeId: string;
  quantity: number;
};

export type AssemblyQuantityResolution = {
  nodeId: string;
  quantity: DrawingImportFieldValue<number>;
  contributions: QuantityContribution[];
  warnings: string[];
};

export type AssemblyQuantityResult = {
  valid: boolean;
  resolutions: AssemblyQuantityResolution[];
  duplicateEdgeIds: string[];
  invalidEdgeIds: string[];
  missingChildEdgeIds: string[];
  cycles: string[][];
  overflowNodeIds: string[];
  warnings: string[];
};
