import type { DrawingImportReviewFile, ReviewedQuoteDrawingPartV2 } from './drawing-import-ui.types';

/** Keep the import recoverable until its receiving draft has acknowledged durable storage. */
export function createDrawingImportHandoff<TPart = ReviewedQuoteDrawingPartV2, TFile = DrawingImportReviewFile>() {
  let pending: Promise<void> | null = null;
  return {
    transfer(
      parts: TPart[], files: TFile[], jobId: string,
      onContinue: (parts: TPart[], files: TFile[], jobId: string) => void | Promise<void>, onAcknowledged: () => void,
    ) {
      if (pending) return pending;
      pending = Promise.resolve()
        .then(() => onContinue(parts, files, jobId))
        .then(onAcknowledged)
        .finally(() => { pending = null; });
      return pending;
    },
  };
}
