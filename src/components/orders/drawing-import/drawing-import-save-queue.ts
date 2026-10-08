import type { DrawingImportReviewPage, SaveDrawingImportCorrectionInput } from './drawing-import-ui.types';

/** Serialize writes to a field so a slower older request cannot win on the server. */
export function createDrawingImportSaveQueue({
  save, onSaved, onError, onPendingChange,
}: {
  save: (input: SaveDrawingImportCorrectionInput) => Promise<DrawingImportReviewPage>;
  onSaved: (input: SaveDrawingImportCorrectionInput, page: DrawingImportReviewPage) => void;
  onError: (input: SaveDrawingImportCorrectionInput, error: unknown) => void;
  onPendingChange: (keys: string[]) => void;
}) {
  const pending = new Map<string, Promise<void>>();
  return {
    enqueue(input: SaveDrawingImportCorrectionInput) {
      const key = `${input.jobId}:${input.pageId}:${input.field}`;
      const previous = pending.get(key) ?? Promise.resolve();
      const next = previous.then(async () => {
        try { onSaved(input, await save(input)); }
        catch (error) { onError(input, error); }
      }).finally(() => {
        if (pending.get(key) === next) pending.delete(key);
        onPendingChange([...pending.keys()]);
      });
      pending.set(key, next);
      onPendingChange([...pending.keys()]);
      return next;
    },
  };
}
