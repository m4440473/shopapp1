'use client';

import * as React from 'react';
import type { QuoteDrawingImportResult } from './quote-drawing-import';

export function DrawingImportDraftReadiness({ result }: { result: QuoteDrawingImportResult }) {
  const incomplete = result.parts.filter((part) => part.unresolvedFields?.length);
  return (
    <section aria-label="Drawing draft readiness" className="space-y-2 rounded-lg border border-border/60 p-3 text-sm">
      {result.blockingIssues.length ? <>
        <p className="font-medium">Resolve these decisions before transferring the drawings:</p>
        <ul className="list-disc space-y-1 pl-5">{result.blockingIssues.map((issue, index) => <li key={`${issue.pageId}-${index}`}>
          <a className="text-primary underline" href={`#${issue.field ? `drawing-field-${issue.pageId}-${issue.field}` : `drawing-page-${issue.pageId}`}`}>{issue.pageLabel ? `${issue.pageLabel}: ` : ''}{issue.message}</a>
        </li>)}</ul>
      </> : result.blockingMessages.length ? <p>{result.blockingMessages.join(' ')}</p> : <p>{result.parts.length ? `${result.parts.length} part${result.parts.length === 1 ? '' : 's'} ready to transfer to the draft.` : 'The saved files can be transferred now. Enter the parts manually in the next step.'}</p>}
      {incomplete.length ? <>
        <p className="font-medium">{incomplete.length} part{incomplete.length === 1 ? '' : 's'} will remain incomplete. Missing or uncertain values are kept for review.</p>
        <ul className="list-disc space-y-1 pl-5">{incomplete.map((part) => <li key={part.importPageId}><a href={`#drawing-page-${part.importPageId}`} className="text-primary underline">{part.partNumber}</a>: {part.reviewWarnings?.join(' ')}</li>)}</ul>
      </> : null}
    </section>
  );
}
