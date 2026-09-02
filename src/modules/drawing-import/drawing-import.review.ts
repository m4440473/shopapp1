import type { DrawingImportProposal } from './drawing-import.schema';
import { parseInchMeasurement } from './drawing-import.materials';

export type DrawingReviewField =
  | 'partNumber'
  | 'partName'
  | 'quantity'
  | 'materialId'
  | 'finish'
  | 'stockSize'
  | 'cutLength'
  | 'finalPartLength'
  | 'partWidth'
  | 'partThickness'
  | 'assembly';

export type DrawingConfirmationNeed = {
  field: DrawingReviewField;
  label: string;
  message: string;
  resolution: 'edit' | 'confirm' | 'decision';
};

type ReviewValues = {
  partNumber: string;
  partName: string;
  quantity: number;
  materialId: string;
  finish: string;
  stockSize: string;
  cutLength: string;
  finalPartLength?: string;
  partWidth?: string;
  partThickness?: string;
};

export function getDrawingConfirmationNeeds(
  part: ReviewValues,
  proposal: DrawingImportProposal | undefined,
  confirmedFields: ReadonlySet<DrawingReviewField>,
): DrawingConfirmationNeed[] {
  const needs: DrawingConfirmationNeed[] = [];
  if (!part.partNumber.trim()) {
    needs.push({ field: 'partNumber', label: 'Part number', message: 'Part number is missing.', resolution: 'edit' });
  } else if (proposal && proposal.partNumber.confidence < 0.8 && !confirmedFields.has('partNumber')) {
    needs.push({ field: 'partNumber', label: 'Part number', message: 'The part number was not read clearly.', resolution: 'confirm' });
  }

  if (!part.partName.trim()) {
    needs.push({ field: 'partName', label: 'Part name', message: 'Part name is missing.', resolution: 'edit' });
  } else if (proposal && proposal.partName.confidence < 0.8 && !confirmedFields.has('partName')) {
    needs.push({ field: 'partName', label: 'Part name', message: 'The part name was not read clearly.', resolution: 'confirm' });
  }

  if (part.quantity < 1) {
    needs.push({ field: 'quantity', label: 'Quantity', message: 'Quantity must be at least 1.', resolution: 'edit' });
  } else if (
    proposal &&
    (proposal.quantity.value === null || proposal.quantity.confidence < 0.8) &&
    !confirmedFields.has('quantity')
  ) {
    needs.push({ field: 'quantity', label: 'Quantity', message: 'Quantity was missing or uncertain; confirm the value shown.', resolution: 'confirm' });
  }

  if (!part.materialId) {
    needs.push({ field: 'materialId', label: 'Material', message: 'Material did not match the catalog; choose one.', resolution: 'edit' });
  }

  if (part.finish.trim() && proposal && proposal.finish.confidence < 0.8 && !confirmedFields.has('finish')) {
    needs.push({ field: 'finish', label: 'Finish', message: 'The finish was not read clearly.', resolution: 'confirm' });
  }
  if (part.stockSize.trim() && proposal && proposal.stockSize.confidence < 0.8 && !confirmedFields.has('stockSize')) {
    needs.push({ field: 'stockSize', label: 'Total stock dimensions', message: 'The stock dimensions were not read clearly.', resolution: 'confirm' });
  }
  if (part.cutLength.trim() && proposal && proposal.cutLength.confidence < 0.8 && !confirmedFields.has('cutLength')) {
    needs.push({ field: 'cutLength', label: 'Cut length', message: 'The cut length was not read clearly.', resolution: 'confirm' });
  }
  if (!part.finalPartLength?.trim()) {
    needs.push({ field: 'finalPartLength', label: 'Final part length', message: 'Enter the finished overall length so cut length and total stock dimensions can be calculated.', resolution: 'edit' });
  } else if (parseInchMeasurement(part.finalPartLength) === null || (parseInchMeasurement(part.finalPartLength) ?? -1) < 0) {
    needs.push({ field: 'finalPartLength', label: 'Final part length', message: 'Enter a valid inch measurement, such as 2.5 or 2 1/2.', resolution: 'edit' });
  } else if (proposal && (proposal.finalPartLength?.confidence ?? 0) < 0.8 && !confirmedFields.has('finalPartLength')) {
    needs.push({ field: 'finalPartLength', label: 'Final part length', message: 'The finished length was not read clearly.', resolution: 'confirm' });
  }
  if (!part.partThickness?.trim()) {
    needs.push({ field: 'partThickness', label: 'Part thickness', message: 'Enter the finished thickness shown on the drawing.', resolution: 'edit' });
  } else if (parseInchMeasurement(part.partThickness) === null || (parseInchMeasurement(part.partThickness) ?? -1) < 0) {
    needs.push({ field: 'partThickness', label: 'Part thickness', message: 'Enter a valid inch measurement, such as .25 or 1/4.', resolution: 'edit' });
  } else if (proposal && (proposal.partThickness?.confidence ?? 0) < 0.8 && !confirmedFields.has('partThickness')) {
    needs.push({ field: 'partThickness', label: 'Part thickness', message: 'The finished thickness was not read clearly.', resolution: 'confirm' });
  }
  if (!part.partWidth?.trim()) {
    needs.push({ field: 'partWidth', label: 'Part width', message: 'Enter the finished width shown on the drawing.', resolution: 'edit' });
  } else if (parseInchMeasurement(part.partWidth) === null || (parseInchMeasurement(part.partWidth) ?? -1) < 0) {
    needs.push({ field: 'partWidth', label: 'Part width', message: 'Enter a valid inch measurement, such as 2.5 or 2 1/2.', resolution: 'edit' });
  } else if (proposal && (proposal.partWidth?.confidence ?? 0) < 0.8 && !confirmedFields.has('partWidth')) {
    needs.push({ field: 'partWidth', label: 'Part width', message: 'The finished width was not read clearly.', resolution: 'confirm' });
  }
  if (proposal?.isAssembly && !confirmedFields.has('assembly')) {
    needs.push({ field: 'assembly', label: 'Assembly', message: 'Decide whether this assembly should remain a part or only an order file.', resolution: 'decision' });
  }
  return needs;
}
