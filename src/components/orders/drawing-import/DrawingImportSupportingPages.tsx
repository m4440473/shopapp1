'use client';

import * as React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';

import type { DrawingImportReviewPage } from './drawing-import-ui.types';

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DrawingImportSupportingPages({
  pages,
  reprocessingPageIds = [],
  onReprocess,
  onClassifyAsPart,
  onKeepFileOnly,
}: {
  pages: DrawingImportReviewPage[];
  reprocessingPageIds?: string[];
  onReprocess?: (pageId: string) => void;
  onClassifyAsPart?: (pageId: string) => void;
  onKeepFileOnly?: (pageId: string) => void;
}) {
  if (!pages.length) return null;
  return (
    <details open={pages.some((page) => page.classification === 'uncertain' || page.processingStatus === 'failed')} className="border-t border-border/60 pt-4" id="drawing-supporting-pages">
      <summary className="cursor-pointer font-semibold">Other packet pages ({pages.length})</summary>
      <div>
        <p className="mt-1 text-sm text-muted-foreground">BOM, cover, reference, duplicate, and uncertain pages remain attached but do not become parts automatically.</p>
      </div>
      <div className="mt-3 divide-y divide-border/60">
        {pages.map((page) => {
          const reprocessing = reprocessingPageIds.includes(page.pageId);
          return (
            <div key={page.pageId} id={`drawing-page-${page.pageId}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{page.filename} · page {page.sourcePageNumber} of {page.sourcePageCount}</p>
                <div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{humanize(page.classification)}</Badge><Badge variant={page.processingStatus === 'failed' ? 'destructive' : 'secondary'}>{humanize(page.processingStatus)}</Badge></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {page.classification !== 'duplicate' && onClassifyAsPart ? <Button type="button" size="sm" disabled={reprocessing} onClick={() => onClassifyAsPart(page.pageId)}>{page.classification === 'reference' ? 'Restore as part' : 'Treat as part drawing'}</Button> : null}
                {page.classification !== 'reference' && page.classification !== 'duplicate' && onKeepFileOnly ? <Button type="button" size="sm" variant="outline" disabled={reprocessing} onClick={() => onKeepFileOnly(page.pageId)}>Keep file only</Button> : null}
                {page.exactPageHref ? <Button asChild type="button" size="sm" variant="outline"><a href={page.exactPageHref} target="_blank" rel="noopener noreferrer">Open page <ExternalLink aria-hidden="true" /></a></Button> : null}
                {onReprocess ? <Button type="button" size="sm" variant="outline" onClick={() => onReprocess(page.pageId)} disabled={reprocessing}><RefreshCw aria-hidden="true" className={reprocessing ? 'animate-spin' : ''} /> Retry</Button> : null}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
