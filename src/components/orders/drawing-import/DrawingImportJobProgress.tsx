'use client';

import { TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { DrawingImportJobProgress as JobProgress } from '@/modules/drawing-import/v2/drawing-import-v2.types';

function formatDuration(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatStage(stage: JobProgress['stage']) {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DrawingImportJobProgress({
  progress,
  showAdminMetrics = false,
  cancelling = false,
  onCancel,
}: {
  progress: JobProgress;
  showAdminMetrics?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const percent = progress.totalPages > 0
    ? Math.min(100, Math.round((progress.completedPages / progress.totalPages) * 100))
    : 0;
  const canCancel = ['QUEUED', 'PROCESSING'].includes(progress.status) && Boolean(onCancel);

  return (
    <section className="space-y-2 border-b border-border/60 pb-3" aria-labelledby={`drawing-job-${progress.jobId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`drawing-job-${progress.jobId}`} className="font-semibold">Drawing import progress</h3>
          <p className="text-sm text-muted-foreground" aria-live="polite">{formatStage(progress.stage)} · {progress.completedPages} of {progress.totalPages} pages</p>
        </div>
        {canCancel ? <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel import'}</Button> : null}
      </div>
      <div
        role="progressbar"
        aria-label="Drawing pages processed"
        aria-valuemin={0}
        aria-valuemax={progress.totalPages}
        aria-valuenow={progress.completedPages}
        className="h-3 overflow-hidden rounded-full border border-primary/30 bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {showAdminMetrics ? (
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Import details</summary><p className="mt-2">Terra {progress.terraProcessedPages} · Local {progress.locallyAcceptedPages} · Needs review {progress.manualReviewPages} · Failed {progress.failedPages} · {formatDuration(progress.elapsedMs)} · Actual ${progress.actualCostUsd.toFixed(2)}</p></details>
      ) : null}
      {progress.errorSummary ? <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"><TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {progress.errorSummary}</p> : null}
    </section>
  );
}
