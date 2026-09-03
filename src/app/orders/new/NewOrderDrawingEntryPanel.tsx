'use client';

import { DrawingImportPanel, type ReviewedDrawingPart } from '@/components/orders/DrawingImportPanel';
import {
  QuoteDrawingImportV2Panel,
  type DrawingImportReviewFile,
  type DrawingImportV2ApiClient,
  type ReviewedQuoteDrawingPartV2,
} from '@/components/orders/drawing-import';

type MaterialOption = { id: string; name: string };

type NewOrderDrawingEntryPanelProps = {
  useLegacyReader: boolean;
  api: DrawingImportV2ApiClient;
  business: string;
  customerName: string;
  draftReference: string;
  materials: MaterialOption[];
  onContinueLegacy: (parts: ReviewedDrawingPart[], files: ReviewedDrawingPart['source'][]) => void;
  onContinueV2: (parts: ReviewedQuoteDrawingPartV2[], files: DrawingImportReviewFile[]) => void;
  onSwitchToLegacy: () => void;
  onSwitchToManual: () => void;
  onCreateMaterial: (name: string) => Promise<MaterialOption>;
};

export function NewOrderDrawingEntryPanel({
  useLegacyReader,
  api,
  business,
  customerName,
  draftReference,
  materials,
  onContinueLegacy,
  onContinueV2,
  onSwitchToLegacy,
  onSwitchToManual,
  onCreateMaterial,
}: NewOrderDrawingEntryPanelProps) {
  if (useLegacyReader) {
    return (
      <DrawingImportPanel
        business={business}
        customerName={customerName}
        draftReference={draftReference}
        materials={materials}
        onContinue={onContinueLegacy}
        onSwitchToManual={onSwitchToManual}
      />
    );
  }

  return (
    <QuoteDrawingImportV2Panel
      api={api}
      destination="order"
      business={business}
      customerName={customerName}
      draftReference={draftReference}
      materials={materials}
      onContinue={onContinueV2}
      onSwitchToLegacy={onSwitchToLegacy}
      onCreateMaterial={onCreateMaterial}
    />
  );
}
