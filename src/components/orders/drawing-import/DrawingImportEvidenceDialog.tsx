'use client';

/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DrawingImportEvidence } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import type { DrawingImportEvidenceUrls } from './drawing-import-ui.types';

function clampPercent(value: number) {
  return `${Math.max(0, Math.min(1, value)) * 100}%`;
}
export function DrawingImportEvidenceDialog({
  open,
  onOpenChange,
  fieldLabel,
  pageLabel,
  evidence,
  urls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldLabel: string;
  pageLabel: string;
  evidence: DrawingImportEvidence | null;
  urls: DrawingImportEvidenceUrls | null;
}) {
  const region = evidence?.sourceRegion ?? null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{fieldLabel} evidence</DialogTitle>
          <DialogDescription>{pageLabel}. The outlined area is the recorded source region.</DialogDescription>
        </DialogHeader>
        {urls?.previewUrl ? (
          <div className="relative overflow-hidden rounded-lg border bg-muted" aria-label={`${fieldLabel} source region on ${pageLabel}`}>
            <img src={urls.previewUrl} alt={`Preview of ${pageLabel}`} className="h-auto w-full" />
            {region ? (
              <span
                className="pointer-events-none absolute border-4 border-[#ff5a00] bg-[#ff5a00]/10 shadow-[0_0_0_2px_rgba(255,255,255,0.85)]"
                style={{
                  left: clampPercent(region[0]),
                  top: clampPercent(region[1]),
                  width: clampPercent(region[2] - region[0]),
                  height: clampPercent(region[3] - region[1]),
                }}
              />
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">A page preview is not available. Open the exact source page below.</p>
        )}
        {urls?.cropUrl ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exact crop</p>
            <img src={urls.cropUrl} alt={`${fieldLabel} evidence crop from ${pageLabel}`} className="max-h-72 w-auto max-w-full rounded-lg border bg-white object-contain" />
          </div>
        ) : null}
        {evidence?.rawText ? (
          <blockquote className="rounded-lg border-l-4 border-primary bg-muted/30 px-3 py-2 text-sm">{evidence.rawText}</blockquote>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Source: {evidence?.sourceType.replace(/_/g, ' ') ?? 'unknown'} · Parser: {evidence?.parser || 'unknown'}</span>
          {urls?.exactPageHref ? (
            <Button asChild type="button" variant="outline" size="sm">
              <a href={urls.exactPageHref} target="_blank" rel="noopener noreferrer">Open exact page <ExternalLink aria-hidden="true" /></a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
