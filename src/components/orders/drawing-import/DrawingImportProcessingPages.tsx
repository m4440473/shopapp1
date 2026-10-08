'use client';

import * as React from 'react';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { DrawingImportReviewPage } from './drawing-import-ui.types';

export function DrawingImportProcessingPages({ pages, active = true }: { pages: DrawingImportReviewPage[]; active?: boolean }) {
  return (
    <section aria-label={active ? 'Automatic drawing review' : 'Saved import pages'} className="space-y-3">
      <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
        {active ? 'AI review starts automatically. You can open drawings now; editing and page-type decisions unlock when the import finishes.' : 'The import stopped. Your saved pages remain available below.'}
      </p>
      {pages.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => (
        <article key={page.pageId} className="space-y-2 rounded-lg border border-border/60 p-3">
          <p className="break-words text-sm font-medium">{page.filename} · page {page.sourcePageNumber} of {page.sourcePageCount}</p>
          {page.previewUrl ? <a href={page.exactPageHref ?? page.previewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${page.filename}, page ${page.sourcePageNumber}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.previewUrl} alt={`Preview of ${page.filename}, page ${page.sourcePageNumber}`} className="h-40 w-full object-contain" loading="lazy" />
          </a> : null}
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {active && page.processingStatus === 'processing' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {page.processingStatus === 'failed' ? 'AI review needs attention' : page.classification === 'duplicate' ? 'Duplicate page retained' : page.processingStatus === 'ready' ? 'Page processed — waiting for final checks' : !active ? 'Page review unfinished' : page.processingStatus === 'processing' ? 'AI reviewing page…' : 'Queued for automatic AI review'}
          </p>
          {page.error ? <p className="text-xs text-destructive">{page.error}</p> : null}
          {page.exactPageHref ? <Button asChild type="button" size="sm" variant="outline"><a href={page.exactPageHref} target="_blank" rel="noopener noreferrer">Open page <ExternalLink aria-hidden="true" /></a></Button> : null}
        </article>
      ))}</div> : <p className="text-sm text-muted-foreground">Preparing the uploaded files and page previews…</p>}
    </section>
  );
}
