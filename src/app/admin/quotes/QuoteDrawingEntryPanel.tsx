'use client';

import { DrawingImportPanel, type ReviewedDrawingPart } from '@/components/orders/DrawingImportPanel';
import {
  QuoteDrawingImportV2Panel,
  type DrawingImportReviewFile,
  type DrawingImportV2ApiClient,
  type ResolveDrawingImportEvidenceUrls,
  type ReviewedQuoteDrawingPartV2,
} from '@/components/orders/drawing-import';

type MaterialOption = { id: string; name: string };

type QuoteDrawingEntryPanelProps = {
  useLegacyImporter: boolean;
  api: DrawingImportV2ApiClient;
  business: string;
  customerName: string;
  draftReference: string;
  materials: MaterialOption[];
  onContinueV2: (parts: ReviewedQuoteDrawingPartV2[], files: DrawingImportReviewFile[]) => void;
  onContinueLegacy: (parts: ReviewedDrawingPart[], files: ReviewedDrawingPart['source'][]) => void;
  onSwitchToLegacy: () => void;
  onSwitchToManual: () => void;
  onCreateMaterial: (detectedName: string) => Promise<MaterialOption>;
  resolveEvidenceUrls: ResolveDrawingImportEvidenceUrls;
};

export function QuoteDrawingEntryPanel({
  useLegacyImporter,
  api,
  business,
  customerName,
  draftReference,
  materials,
  onContinueV2,
  onContinueLegacy,
  onSwitchToLegacy,
  onSwitchToManual,
  onCreateMaterial,
  resolveEvidenceUrls,
}: QuoteDrawingEntryPanelProps) {
  if (useLegacyImporter) {
    return (
      <DrawingImportPanel
        business={business}
        customerName={customerName}
        draftReference={draftReference}
        materials={materials}
        destinationLabel="quote"
        onContinue={onContinueLegacy}
        onSwitchToManual={onSwitchToManual}
      />
    );
  }

  return (
    <QuoteDrawingImportV2Panel
      api={api}
      business={business}
      customerName={customerName}
      draftReference={draftReference}
      materials={materials}
      onContinue={onContinueV2}
      onSwitchToLegacy={onSwitchToLegacy}
      onCreateMaterial={onCreateMaterial}
      resolveEvidenceUrls={resolveEvidenceUrls}
    />
  );
}
