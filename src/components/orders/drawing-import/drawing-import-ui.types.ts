import type {
  DrawingImportEvidence,
  DrawingImportFieldName,
  DrawingImportJobProgress,
  DrawingImportPageClassification,
  DrawingImportPageExtraction,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';
import type { CustomerPartNoteSuggestion } from '@/modules/customer-parts/customer-parts.types';

export type DrawingImportPageProcessingStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';

export type DrawingImportReviewPage = {
  pageId: string;
  filename: string;
  sourcePageNumber: number;
  sourcePageCount: number;
  classification: DrawingImportPageClassification;
  processingStatus: DrawingImportPageProcessingStatus;
  extraction: DrawingImportPageExtraction | null;
  exactPageHref: string | null;
  originalPacketHref: string | null;
  previewUrl: string | null;
  canonicalSource: DrawingImportReviewFile | null;
  originalPacketSource: DrawingImportReviewFile | null;
  error: string | null;
  warnings: string[];
};

export type DrawingImportReviewFile = {
  storagePath: string;
  label: string;
  mimeType: string;
};

export type DrawingImportJobSnapshot = {
  progress: DrawingImportJobProgress;
  pages: DrawingImportReviewPage[];
  supportingFiles: DrawingImportReviewFile[];
};

export type DrawingImportReviewState = DrawingImportJobSnapshot & {
  dirtyFieldsByPage: Record<string, DrawingImportFieldName[]>;
};

export type DrawingImportReviewFilter =
  | 'all'
  | 'missing'
  | 'unreadable'
  | 'conflicting'
  | 'uncertain'
  | 'duplicate'
  | 'failed';

export type DrawingImportEvidenceUrls = {
  previewUrl: string | null;
  cropUrl: string | null;
  exactPageHref: string | null;
};

export type ResolveDrawingImportEvidenceUrls = (
  page: DrawingImportReviewPage,
  evidence: DrawingImportEvidence,
) => DrawingImportEvidenceUrls;

export type DrawingImportV2FeatureStatus = {
  enabled: boolean;
  mode: 'disabled' | 'shadow' | 'admin_beta' | 'default';
  version: 'V2' | 'V3';
  reason: string | null;
};

export type StartQuoteDrawingImportInput = {
  file: File;
  business: string;
  customerName: string;
  draftReference: string;
  intakeMode: 'ONE_OFF' | 'ASSEMBLY';
  assemblyMultiplier: number;
};

export type SaveDrawingImportCorrectionInput = {
  jobId: string;
  pageId: string;
  field: DrawingImportFieldName;
  value: string | number | boolean | null;
};

export type SaveDrawingImportClassificationInput = {
  jobId: string;
  pageId: string;
  classification: DrawingImportPageClassification;
};

/** Route-independent API contract supplied by the quote workflow adapter. */
export type DrawingImportV2ApiClient = {
  getFeatureStatus: () => Promise<DrawingImportV2FeatureStatus>;
  startQuoteImport: (input: StartQuoteDrawingImportInput) => Promise<DrawingImportJobSnapshot>;
  getJob: (jobId: string) => Promise<DrawingImportJobSnapshot>;
  cancelJob: (jobId: string) => Promise<DrawingImportJobSnapshot>;
  reprocessPage: (jobId: string, pageId: string) => Promise<DrawingImportJobSnapshot>;
  saveCorrection: (input: SaveDrawingImportCorrectionInput) => Promise<DrawingImportReviewPage>;
  saveClassification: (input: SaveDrawingImportClassificationInput) => Promise<DrawingImportReviewPage>;
};

export type ReviewedQuoteDrawingPartV2 = {
  key: string;
  importPageId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  materialId: string;
  finish: string;
  stockSize: string;
  cutLength: string;
  finalPartLength: string;
  partWidth: string;
  partThickness: string;
  revision: string;
  drawingMaterialText: string;
  drawingFinishText: string;
  noteSuggestions: CustomerPartNoteSuggestion[];
  source: DrawingImportReviewFile;
};
