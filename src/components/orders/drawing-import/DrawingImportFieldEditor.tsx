'use client';

import * as React from 'react';
import { Eye, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { drawingImportFieldNeedsAttention } from './drawing-import-review-state';
import { displayDrawingDimension, parseDrawingDimensionInput, type DrawingDimensionUnit } from './drawing-import-dimension-units';
import type {
  DrawingImportEvidence,
  DrawingImportFieldName,
  DrawingImportFieldValue,
} from '@/modules/drawing-import/v2/drawing-import-v2.types';

type FieldPrimitive = string | number | boolean;

function statusLabel(status: DrawingImportFieldValue<FieldPrimitive>['status']) {
  return status.replace(/_/g, ' ');
}

function sourceLabel(evidence: DrawingImportEvidence | undefined) {
  return evidence?.sourceType.replace(/_/g, ' ') ?? 'no evidence';
}

export function canCreateDrawingImportCatalogValue(field: DrawingImportFieldName) {
  return field === 'material';
}

export function canConfirmDrawingImportFieldValue(value: DrawingImportFieldValue<FieldPrimitive>) {
  return value.value !== null && String(value.value).trim().length > 0;
}

export function shouldShowDrawingImportConflictChoices(value: DrawingImportFieldValue<FieldPrimitive>) {
  return value.status === 'conflicting' && value.candidates.length > 1;
}

export function shouldCommitDrawingImportFieldOnBlur(dirty: boolean) {
  return dirty;
}

export function DrawingImportFieldEditor({
  field,
  inputId,
  label,
  value,
  dirty = false,
  onChange,
  onCommit,
  onChooseCandidate,
  onOpenEvidence,
  choices,
  creatingValue = false,
  onCreateValue,
  dimensionUnit,
}: {
  field: DrawingImportFieldName;
  inputId: string;
  label: string;
  value: DrawingImportFieldValue<FieldPrimitive>;
  dirty?: boolean;
  onChange: (value: FieldPrimitive | null) => void;
  onCommit: (valueOverride?: FieldPrimitive | null) => void;
  onChooseCandidate: (value: FieldPrimitive) => void;
  onOpenEvidence: (evidence: DrawingImportEvidence) => void;
  choices?: Array<{ value: string; label: string }>;
  creatingValue?: boolean;
  onCreateValue?: (value: string) => void;
  dimensionUnit?: DrawingDimensionUnit;
}) {
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [dimensionDraft, setDimensionDraft] = React.useState<{ text: string; unit: DrawingDimensionUnit } | null>(null);
  const activeDraft = dimensionDraft?.unit === dimensionUnit ? dimensionDraft : null;
  const invalidDimension = Boolean(activeDraft?.text.trim() && parseDrawingDimensionInput(activeDraft.text, activeDraft.unit) === null);
  const needsAttention = drawingImportFieldNeedsAttention(field, value);
  const primaryEvidence = value.evidence[0];
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <Label htmlFor={inputId} className="text-sm font-medium">{label}{dimensionUnit ? ` (${dimensionUnit})` : ''}</Label>
        {dirty ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
      </div>
      {typeof value.value === 'boolean' || field === 'assemblyStatus' ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
          {([true, false, null] as const).map((candidate) => (
            <Button
              key={String(candidate)}
              type="button"
              size="sm"
              variant={value.value === candidate ? 'default' : 'outline'}
              aria-pressed={value.value === candidate}
              onClick={() => { onChange(candidate); onCommit(candidate); }}
            >
              {candidate === null ? 'Unknown' : candidate ? 'Yes' : 'No'}
            </Button>
          ))}
        </div>
      ) : choices ? (
        <select
          id={inputId}
          className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark] ${needsAttention ? 'border-[#ff5a00]' : 'border-input'}`}
          value={typeof value.value === 'string' ? value.value : ''}
          onChange={(event) => { const next = event.target.value || null; onChange(next); onCommit(next); }}
          aria-invalid={needsAttention}
        >
          <option className="bg-background text-foreground" value="">Choose a saved material</option>
          {typeof value.value === 'string' && value.value && !choices.some((choice) => choice.value.toLowerCase() === value.value?.toString().toLowerCase()) ? <option className="bg-background text-foreground" value={value.value}>{value.value} (detected)</option> : null}
          {choices.map((choice) => <option className="bg-background text-foreground" key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      ) : (
        <Input
          id={inputId}
          type={field === 'drawingQuantity' ? 'number' : 'text'}
          min={field === 'drawingQuantity' ? 1 : undefined}
          step={field === 'drawingQuantity' ? 1 : undefined}
          value={dimensionUnit ? activeDraft?.text ?? displayDrawingDimension(value.value === null ? null : String(value.value), dimensionUnit) : value.value ?? ''}
          onChange={(event) => {
            if (dimensionUnit) {
              setDimensionDraft({ text: event.target.value, unit: dimensionUnit });
              onChange(parseDrawingDimensionInput(event.target.value, dimensionUnit));
            }
            else if (field !== 'drawingQuantity') onChange(event.target.value);
            else if (!event.target.value) onChange(null);
            else {
              const parsed = Number(event.target.value);
              if (Number.isInteger(parsed) && parsed > 0) onChange(parsed);
            }
          }}
          onFocus={(event) => { if (field === 'drawingQuantity') event.currentTarget.select(); }}
          onBlur={() => {
            if (shouldCommitDrawingImportFieldOnBlur(dirty)) onCommit();
            if (!invalidDimension) setDimensionDraft(null);
          }}
          aria-invalid={needsAttention || invalidDimension}
        />
      )}
      {invalidDimension ? <p role="alert" className="text-xs text-destructive">Enter a number or fraction in {dimensionUnit}. This dimension remains unconfirmed.</p> : null}
      {canCreateDrawingImportCatalogValue(field) && onCreateValue && typeof value.value === 'string' && value.value.trim() && !choices?.some((choice) => choice.value.trim().toLowerCase() === value.value?.toString().trim().toLowerCase()) ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onCreateValue(value.value as string)} disabled={creatingValue}>{creatingValue ? 'Adding material…' : `Add “${value.value.trim()}” to materials`}</Button>
      ) : null}
      {needsAttention ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9a3412] dark:text-orange-200">
          <span className="flex items-center gap-1">
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
            {canConfirmDrawingImportFieldValue(value) ? 'Correct the value above or confirm it.' : 'Enter the correct value above.'}
          </span>
          {canConfirmDrawingImportFieldValue(value) ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onCommit(value.value)}>
              Confirm shown value
            </Button>
          ) : null}
        </div>
      ) : null}
      {shouldShowDrawingImportConflictChoices(value) ? (
        <div className="space-y-2 border-l-2 border-amber-500 pl-3 text-xs">
          <p className="flex items-center gap-1 font-semibold"><TriangleAlert aria-hidden="true" className="h-4 w-4" /> Conflicting candidates</p>
          <div className="flex flex-wrap gap-2">
            {value.candidates.map((candidate, index) => (
              <Button key={`${String(candidate.value)}-${index}`} type="button" size="sm" variant="outline" onClick={() => onChooseCandidate(candidate.value)}>
                Use {String(candidate.value)} · {candidate.sourceType.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {needsAttention && (value.evidence.length || value.rawText || value.warnings.length) ? (
        <details
          className="text-xs text-muted-foreground"
          open={reasonOpen}
          onToggle={(event) => setReasonOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer">Why this needs review</summary>
          <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
            <p>{statusLabel(value.status)}{primaryEvidence ? ` · ${sourceLabel(primaryEvidence)}` : ''}</p>
            {value.evidence.length ? (
              <div className="flex flex-wrap gap-1">
                {value.evidence.map((evidence, index) => (
                  <Button key={`${evidence.sourcePageId}-${evidence.sourceType}-${index}`} type="button" variant="ghost" size="sm" onClick={() => onOpenEvidence(evidence)} aria-label={`View ${label} evidence from ${evidence.sourceType.replace(/_/g, ' ')}`}>
                    <Eye aria-hidden="true" /> Source {value.evidence.length > 1 ? index + 1 : ''}
                  </Button>
                ))}
              </div>
            ) : null}
            {value.rawText ? <p>Drawing text: {value.rawText}</p> : null}
            {value.warnings.map((warning) => <p key={warning} className="text-[#9a3412] dark:text-orange-200">{warning}</p>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
