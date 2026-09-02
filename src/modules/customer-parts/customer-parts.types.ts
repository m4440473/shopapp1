export type CustomerPartHistoryVersion = {
  sourcePartId: string;
  sourceOrderId: string;
  sourceOrderNumber: string;
  sourceOrderStatus: string;
  sourceCustomerName: string;
  business: string;
  partNumber: string;
  partName: string | null;
  materialName: string | null;
  receivedAt: string;
  updatedAt: string;
  hasDrawing: boolean;
};

export type CustomerPartHistorySummary = {
  groupKey: string;
  normalizedPartNumber: string;
  partNumber: string;
  partName: string | null;
  materialName: string | null;
  versionCount: number;
  hasConflictingVersions: boolean;
  latest: CustomerPartHistoryVersion;
  versions: CustomerPartHistoryVersion[];
};

export type CustomerPartDrawingAttachment = {
  kind: 'DWG' | 'STEP' | 'PDF' | 'PRINT' | 'IMAGE';
  url: string | null;
  storagePath: string | null;
  label: string | null;
  mimeType: string | null;
};

export type CustomerPartNoteSuggestion = {
  id: string;
  destination: 'notes' | 'workInstructions';
  text: string;
  source: 'reviewed_part_note' | 'reviewed_work_instruction' | 'drawing_extraction';
  sourceLabel: string;
  evidenceHref: string | null;
  evidenceQuality: 'human_reviewed' | 'mapped_region' | 'page_only';
  requiresDrawingReview: boolean;
};

export type CustomerPartHistoryDetail = {
  customerId: string;
  sourcePartId: string;
  sourceOrderId: string;
  sourceOrderNumber: string;
  sourceOrderStatus: string;
  business: string;
  receivedAt: string;
  partNumber: string;
  partName: string | null;
  materialId: string | null;
  drawingMaterialText: string | null;
  drawingFinishText: string | null;
  finish: string | null;
  stockSize: string | null;
  cutLength: string | null;
  finalPartLength: string | null;
  partWidth: string | null;
  partThickness: string | null;
  drawingImportPageId: string | null;
  attachments: CustomerPartDrawingAttachment[];
  noteSuggestions: CustomerPartNoteSuggestion[];
};

export type CustomerPartReusableDraft = {
  key: string;
  sourcePartId: string;
  partNumber: string;
  partName: string;
  materialId: string;
  drawingMaterialText: string;
  drawingFinishText: string;
  finish: string;
  stockSize: string;
  cutLength: string;
  finalPartLength: string;
  partWidth: string;
  partThickness: string;
  drawingImportPageId?: string;
  quantity: string;
  pieceCount: string;
  materialStatus: 'UNREVIEWED';
  inventoryLocation: string;
  materialNotes: string;
  procurementVendorId: string;
  procurementCost: string;
  procurementMarkupPercent: string;
  notes: string;
  workInstructions: string;
  addonSelections: [];
  attachments: CustomerPartDrawingAttachment[];
  noteSuggestions: CustomerPartNoteSuggestion[];
};
