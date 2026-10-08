import { describe, expect, it, vi } from 'vitest';
import { createDrawingImportHandoff } from '../drawing-import-handoff';
import type { DrawingImportReviewFile } from '../drawing-import-ui.types';
import type { ReviewedDrawingPart } from '../../DrawingImportPanel';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const files: DrawingImportReviewFile[] = [{ storagePath: 'existing/page.pdf', label: 'Drawing', mimeType: 'application/pdf' }];
const legacyParts: ReviewedDrawingPart[] = [{ key: 'legacy-1', partNumber: 'B-1', partName: 'Bracket', quantity: 2, materialId: 'aluminum',
  finish: '', stockSize: '1 x 2 x 3', cutLength: '3', finalPartLength: '2.875', partWidth: '2', partThickness: '1',
  drawingMaterialText: 'Aluminum', drawingFinishText: '', source: files[0] }];

describe('acknowledged import handoff', () => {
  it('retains the recovery ID until the parent draft is saved and does not overlap transfer clicks', async () => {
    const draft = deferred();
    const onContinue = vi.fn(() => draft.promise);
    let recoveryId: string | null = 'job-1';
    const clear = vi.fn(() => { recoveryId = null; });
    const handoff = createDrawingImportHandoff();
    const first = handoff.transfer([], files, 'job-1', onContinue, clear);
    const second = handoff.transfer([], files, 'job-1', onContinue, clear);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith([], files, 'job-1');
    expect(recoveryId).toBe('job-1');
    expect(clear).not.toHaveBeenCalled();
    draft.resolve();
    await first;
    expect(recoveryId).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the original files and recovery ID after rejection, then permits one explicit retry', async () => {
    const onContinue = vi.fn().mockRejectedValueOnce(new Error('Draft save unavailable')).mockResolvedValueOnce(undefined);
    const clear = vi.fn();
    const handoff = createDrawingImportHandoff();
    await expect(handoff.transfer([], files, 'job-1', onContinue, clear)).rejects.toThrow('Draft save unavailable');
    expect(clear).not.toHaveBeenCalled();
    expect(files).toEqual([{ storagePath: 'existing/page.pdf', label: 'Drawing', mimeType: 'application/pdf' }]);
    await handoff.transfer([], files, 'job-1', onContinue, clear);
    expect(onContinue).toHaveBeenCalledTimes(2);
    expect(onContinue.mock.calls[0]).toEqual(onContinue.mock.calls[1]);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('waits for the legacy parent save and shares simultaneous clicks without clearing its reviewed source', async () => {
    const savedDraft = deferred();
    const parent = vi.fn(() => savedDraft.promise);
    const acknowledged = vi.fn();
    const handoff = createDrawingImportHandoff<ReviewedDrawingPart, ReviewedDrawingPart['source']>();
    const first = handoff.transfer(legacyParts, files, 'legacy-reference', parent, acknowledged);
    expect(handoff.transfer(legacyParts, files, 'legacy-reference', parent, acknowledged)).toBe(first);
    await Promise.resolve();
    expect(parent).toHaveBeenCalledTimes(1);
    expect(acknowledged).not.toHaveBeenCalled();
    expect(legacyParts[0].source.storagePath).toBe('existing/page.pdf');
    savedDraft.resolve();
    await first;
    expect(acknowledged).toHaveBeenCalledTimes(1);
    expect(legacyParts).toHaveLength(1);
  });

  it('retains legacy reviewed fields and uploaded paths after a failed draft save, allowing explicit retry', async () => {
    const original = JSON.parse(JSON.stringify(legacyParts));
    const parent = vi.fn().mockRejectedValueOnce(new Error('Draft revision conflict')).mockResolvedValueOnce(undefined);
    const acknowledged = vi.fn();
    const handoff = createDrawingImportHandoff<ReviewedDrawingPart, ReviewedDrawingPart['source']>();
    await expect(handoff.transfer(legacyParts, files, 'legacy-reference', parent, acknowledged)).rejects.toThrow('Draft revision conflict');
    expect(acknowledged).not.toHaveBeenCalled();
    expect(legacyParts).toEqual(original);
    await handoff.transfer(legacyParts, files, 'legacy-reference', parent, acknowledged);
    expect(parent.mock.calls[1]).toEqual(parent.mock.calls[0]);
    expect(acknowledged).toHaveBeenCalledTimes(1);
    expect(legacyParts).toEqual(original);
  });
});
