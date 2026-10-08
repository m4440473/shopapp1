import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DrawingImportProcessingPages } from '../DrawingImportProcessingPages';
import { DrawingImportSupportingPages } from '../DrawingImportSupportingPages';
import { DrawingImportDraftReadiness } from '../DrawingImportDraftReadiness';
import { drawingImportProgressLabel } from '../DrawingImportJobProgress';
import type { DrawingImportReviewPage } from '../drawing-import-ui.types';
import type { DrawingImportJobProgress } from '@/modules/drawing-import/v2/drawing-import-v2.types';

function page(processingStatus: DrawingImportReviewPage['processingStatus'], classification: DrawingImportReviewPage['classification']): DrawingImportReviewPage {
  return {
    pageId: processingStatus, filename: `${processingStatus}.pdf`, sourcePageNumber: 1, sourcePageCount: 1,
    processingStatus, classification, extraction: null, exactPageHref: `/page/${processingStatus}`,
    originalPacketHref: null, previewUrl: `/preview/${processingStatus}`, canonicalSource: null, originalPacketSource: null,
    error: null, warnings: [],
  };
}

describe('drawing import processing presentation', () => {
  it('offers Keep file only for uncertain and failed pages without an AI result', () => {
    const html = renderToStaticMarkup(React.createElement(DrawingImportSupportingPages, {
      pages: [page('ready', 'uncertain'), page('failed', 'part_drawing')], onKeepFileOnly: () => undefined,
    }));
    expect(html.match(/Keep file only/g)).toHaveLength(2);
    expect(html).toContain('href="/page/failed"');
    expect(html).not.toContain('Treat as part');
    expect(html).toContain('<details open=""');
  });

  it('links unresolved identity blockers to the relevant fields', () => {
    const html = renderToStaticMarkup(React.createElement(DrawingImportDraftReadiness, { result: {
      parts: [], files: [], blockingMessages: ['Quantity requires confirmation.'],
      blockingIssues: [{ pageId: 'page-1', field: 'drawingQuantity', message: 'Quantity requires confirmation.' }],
    } }));
    expect(html).toContain('href="#drawing-field-page-1-drawingQuantity"');
    expect(html).toContain('Quantity requires confirmation.');
  });

  it('shows uncertain and initially BOM pages as automatic review work with available previews, without manual classification controls', () => {
    const html = renderToStaticMarkup(React.createElement(DrawingImportProcessingPages, { pages: [page('queued', 'uncertain'), page('processing', 'bom')] }));
    expect(html).toContain('AI review starts automatically');
    expect(html).toContain('Queued for automatic AI review');
    expect(html).toContain('AI reviewing page');
    expect(html).toContain('href="/page/queued"');
    expect(html).toContain('src="/preview/processing"');
    expect(html).not.toContain('Other packet pages');
    expect(html).not.toContain('Treat as part');
    expect(html).not.toContain('<input');
  });

  it('does not announce an import ready because every page is processed while finalization still runs', () => {
    const progress = { status: 'PROCESSING', stage: 'bom_analysis', totalPages: 7, completedPages: 7 } as DrawingImportJobProgress;
    expect(drawingImportProgressLabel(progress)).toBe('Finalizing import — please wait');
    expect(drawingImportProgressLabel({ ...progress, status: 'READY_FOR_REVIEW' })).toBe('Ready for review');
    expect(drawingImportProgressLabel({ ...progress, status: 'FAILED' })).toBe('Import needs attention');
  });
});
