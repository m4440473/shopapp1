import { describe, expect, it, vi } from 'vitest';
import { createDrawingImportSaveQueue } from '../drawing-import-save-queue';
import type { DrawingImportReviewPage, SaveDrawingImportCorrectionInput } from '../drawing-import-ui.types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const input: SaveDrawingImportCorrectionInput = { jobId: 'job-1', pageId: 'page-1', field: 'partNumber', value: 'FIRST' };
const saved = { pageId: 'page-1' } as DrawingImportReviewPage;

describe('drawing correction save queue', () => {
  it('saves a second blurred value after an in-flight first value without dropping or reordering it', async () => {
    const first = deferred<DrawingImportReviewPage>();
    const second = deferred<DrawingImportReviewPage>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onSaved = vi.fn();
    const onPendingChange = vi.fn();
    const queue = createDrawingImportSaveQueue({ save, onSaved, onError: vi.fn(), onPendingChange });
    const one = queue.enqueue(input);
    const two = queue.enqueue({ ...input, value: 'SECOND' });
    await Promise.resolve();
    expect(save.mock.calls.map(([request]) => request.value)).toEqual(['FIRST']);
    first.resolve(saved);
    await one;
    await Promise.resolve();
    expect(save.mock.calls.map(([request]) => request.value)).toEqual(['FIRST', 'SECOND']);
    expect(onPendingChange.mock.lastCall![0]).toHaveLength(1);
    second.resolve(saved);
    await two;
    expect(onSaved.mock.calls.map(([request]) => request.value)).toEqual(['FIRST', 'SECOND']);
    expect(onPendingChange.mock.lastCall![0]).toEqual([]);
  });

  it('keeps a later correction queued when the first save fails, and reports the failure', async () => {
    const first = deferred<DrawingImportReviewPage>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(saved);
    const onError = vi.fn();
    const onSaved = vi.fn();
    const queue = createDrawingImportSaveQueue({ save, onSaved, onError, onPendingChange: vi.fn() });
    const one = queue.enqueue(input);
    const two = queue.enqueue({ ...input, value: 'LATEST' });
    first.reject(new Error('Network interrupted'));
    await Promise.all([one, two]);
    expect(onError).toHaveBeenCalledWith(input, expect.objectContaining({ message: 'Network interrupted' }));
    expect(onSaved).toHaveBeenCalledWith({ ...input, value: 'LATEST' }, saved);
  });
});
