import type { CustomerPartHistoryDetail, CustomerPartReusableDraft } from './customer-parts.types';

export function mapCustomerPartDetailToReusableDraft(
  detail: CustomerPartHistoryDetail,
  createKey: () => string,
): CustomerPartReusableDraft {
  return {
    key: createKey(),
    sourcePartId: detail.sourcePartId,
    partNumber: detail.partNumber,
    partName: detail.partName ?? '',
    materialId: detail.materialId ?? '',
    drawingMaterialText: detail.drawingMaterialText ?? '',
    drawingFinishText: detail.drawingFinishText ?? '',
    finish: detail.finish ?? '',
    stockSize: detail.stockSize ?? '',
    cutLength: detail.cutLength ?? '',
    finalPartLength: detail.finalPartLength ?? '',
    partWidth: detail.partWidth ?? '',
    partThickness: detail.partThickness ?? '',
    drawingImportPageId: detail.drawingImportPageId ?? undefined,
    quantity: '1',
    pieceCount: '1',
    materialStatus: 'UNREVIEWED',
    inventoryLocation: '',
    materialNotes: '',
    procurementVendorId: '',
    procurementCost: '',
    procurementMarkupPercent: '20',
    notes: '',
    workInstructions: '',
    addonSelections: [],
    attachments: detail.attachments.map((attachment) => ({ ...attachment })),
    noteSuggestions: detail.noteSuggestions.map((suggestion) => ({ ...suggestion })),
  };
}
