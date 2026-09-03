'use client';

import * as React from 'react';
import { ExternalLink, FileText, RefreshCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type {
  DrawingImportEvidence,
  DrawingImportFieldName,
  DrawingImportFieldValue,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';
import { deriveCutAndStockLength } from '@/modules/drawing-import/drawing-import.materials';

import { DrawingImportEvidenceDialog } from './DrawingImportEvidenceDialog';
import { DrawingImportFieldEditor } from './DrawingImportFieldEditor';
import { drawingImportFieldNeedsAttention } from './drawing-import-review-state';
import { displayDrawingDimension, type DrawingDimensionUnit } from './drawing-import-dimension-units';
import type {
  DrawingImportEvidenceUrls,
  DrawingImportReviewPage,
  ResolveDrawingImportEvidenceUrls,
} from './drawing-import-ui.types';

type FieldPrimitive = string | number | boolean;

const FIELD_LABELS: Record<DrawingImportFieldName, string> = {
  partNumber: 'Part number',
  partName: 'Part name / description',
  drawingQuantity: 'Drawing quantity',
  material: 'Material',
  finish: 'Finish',
  stockSize: 'Stock size',
  cutLength: 'Cut length',
  finalLength: 'Final length',
  partWidth: 'Width / outside diameter',
  partThickness: 'Thickness / wall thickness',
  revision: 'Revision (optional)',
  assemblyStatus: 'Assembly',
};

const FIELD_NAMES: DrawingImportFieldName[] = [
  'partNumber', 'partName', 'drawingQuantity', 'material', 'finish',
  'finalLength', 'partWidth', 'partThickness', 'revision', 'assemblyStatus',
];
const FIELD_GROUPS: DrawingImportFieldName[][] = [
  ['partNumber', 'partName', 'revision'],
  ['drawingQuantity', 'material', 'finish', 'assemblyStatus'],
  ['finalLength', 'partWidth', 'partThickness'],
];

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DrawingImportPageCard({
  page,
  dirtyFields = [],
  reprocessing = false,
  resolveEvidenceUrls,
  onFieldChange,
  onFieldCommit,
  onChooseCandidate,
  onReprocess,
  fieldChoices,
  creatingFields = [],
  onCreateFieldValue,
  onKeepFileOnly,
}: {
  page: DrawingImportReviewPage;
  dirtyFields?: DrawingImportFieldName[];
  reprocessing?: boolean;
  resolveEvidenceUrls?: ResolveDrawingImportEvidenceUrls;
  onFieldChange: (pageId: string, field: DrawingImportFieldName, value: FieldPrimitive | null) => void;
  onFieldCommit: (pageId: string, field: DrawingImportFieldName, valueOverride?: FieldPrimitive | null) => void;
  onChooseCandidate: (pageId: string, field: DrawingImportFieldName, value: FieldPrimitive) => void;
  onReprocess?: (pageId: string) => void;
  fieldChoices?: Partial<Record<DrawingImportFieldName, Array<{ value: string; label: string }>>>;
  creatingFields?: DrawingImportFieldName[];
  onCreateFieldValue?: (pageId: string, field: DrawingImportFieldName, value: string) => void;
  onKeepFileOnly?: (pageId: string) => void;
}) {
  const [dimensionUnit, setDimensionUnit] = React.useState<DrawingDimensionUnit>('in');
  const [evidenceSelection, setEvidenceSelection] = React.useState<{
    field: DrawingImportFieldName;
    evidence: DrawingImportEvidence;
  } | null>(null);
  const evidenceUrls: DrawingImportEvidenceUrls | null = evidenceSelection && resolveEvidenceUrls
    ? resolveEvidenceUrls(page, evidenceSelection.evidence)
    : evidenceSelection
      ? { previewUrl: page.previewUrl, cropUrl: null, exactPageHref: page.exactPageHref }
      : null;
  const pageLabel = `${page.filename}, page ${page.sourcePageNumber} of ${page.sourcePageCount}`;
  const needsAttention = page.processingStatus === 'failed'
    || page.classification === 'uncertain'
    || Boolean(page.extraction && FIELD_NAMES.some((field) => page.extraction && drawingImportFieldNeedsAttention(field, page.extraction[field])));
  const calculatedLengths = page.extraction
    ? deriveCutAndStockLength(page.extraction.finalLength.value, Number(page.extraction.drawingQuantity.value))
    : { cutLength: '', stockLength: '' };

  return (
    <article className={`border-b py-3 ${needsAttention ? 'border-[#ff5a00]/70' : 'border-border/60'}`} aria-labelledby={`drawing-page-${page.pageId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`drawing-page-${page.pageId}`} className="flex items-center gap-2 font-semibold"><FileText aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{pageLabel}</span></h3>
          <p className="mt-1 text-xs text-muted-foreground">{humanize(page.classification)} · {humanize(page.processingStatus)}{needsAttention ? ' · Needs review' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onKeepFileOnly ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium">
              <input type="checkbox" checked onChange={(event) => { if (!event.target.checked) onKeepFileOnly(page.pageId); }} />
              Create quote part
              <span className="text-muted-foreground">(uncheck to keep file only)</span>
            </label>
          ) : null}
          {page.exactPageHref ? <Button asChild type="button" variant="outline" size="sm"><a href={page.exactPageHref} target="_blank" rel="noopener noreferrer">Exact page <ExternalLink aria-hidden="true" /></a></Button> : null}
          {onReprocess ? <Button type="button" variant="outline" size="sm" onClick={() => onReprocess(page.pageId)} disabled={reprocessing}><RefreshCw aria-hidden="true" className={reprocessing ? 'animate-spin' : ''} /> {reprocessing ? 'Reprocessing…' : 'Reprocess'}</Button> : null}
        </div>
      </div>
      {page.originalPacketHref ? <a href={page.originalPacketHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Open original packet</a> : null}
      {page.error ? <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"><TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {page.error}</p> : null}
      {page.warnings.length ? <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Import notes ({page.warnings.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5">{page.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      {page.extraction ? (
        <div className="mt-3 grid items-start gap-3 lg:grid-cols-3">
          {FIELD_GROUPS.map((fields, groupIndex) => (
            <div key={fields.join('-')} className="space-y-2">
              {groupIndex === 2 ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Dimensions</span>
                  <div role="group" aria-label="Dimension units" className="inline-flex rounded-md border border-border p-0.5">
                    {(['in', 'mm'] as const).map((unit) => (
                      <button key={unit} type="button" aria-pressed={dimensionUnit === unit} onClick={() => setDimensionUnit(unit)} className={`rounded px-2 py-0.5 text-xs font-medium ${dimensionUnit === unit ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{unit}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {fields.map((field) => (
                <DrawingImportFieldEditor
                  key={field}
                  field={field}
                  inputId={`drawing-field-${page.pageId}-${field}`}
                  label={FIELD_LABELS[field]}
                  value={page.extraction?.[field] as DrawingImportFieldValue<FieldPrimitive>}
                  dirty={dirtyFields.includes(field)}
                  dimensionUnit={groupIndex === 2 ? dimensionUnit : undefined}
                  onChange={(value) => onFieldChange(page.pageId, field, value)}
                  onCommit={(valueOverride) => onFieldCommit(page.pageId, field, valueOverride)}
                  onChooseCandidate={(value) => onChooseCandidate(page.pageId, field, value)}
                  onOpenEvidence={(evidence) => setEvidenceSelection({ field, evidence })}
                  choices={fieldChoices?.[field]}
                  creatingValue={creatingFields.includes(field)}
                  onCreateValue={field === 'material' && onCreateFieldValue ? (value) => onCreateFieldValue(page.pageId, field, value) : undefined}
                />
              ))}
              {groupIndex === 2 ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/60 pt-2 text-sm">
                  <p><span className="font-medium">Cut:</span> {calculatedLengths.cutLength ? `${displayDrawingDimension(calculatedLengths.cutLength, dimensionUnit)} ${dimensionUnit}` : 'enter final length'} <span className="text-xs text-muted-foreground">(+{dimensionUnit === 'mm' ? '3.175 mm' : '0.125 in'})</span></p>
                  <p><span className="font-medium">Total stock:</span> {calculatedLengths.stockLength ? `${displayDrawingDimension(calculatedLengths.stockLength, dimensionUnit)} ${dimensionUnit}` : 'enter length and quantity'} <span className="text-xs text-muted-foreground">(cut × qty)</span></p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-border/60 p-4 text-sm text-muted-foreground" role="status">This page has not produced a review result yet.</p>
      )}
      <DrawingImportEvidenceDialog
        open={Boolean(evidenceSelection)}
        onOpenChange={(open) => { if (!open) setEvidenceSelection(null); }}
        fieldLabel={evidenceSelection ? FIELD_LABELS[evidenceSelection.field] : 'Field'}
        pageLabel={pageLabel}
        evidence={evidenceSelection?.evidence ?? null}
        urls={evidenceUrls}
      />
    </article>
  );
}
