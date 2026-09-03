'use client';

import { Button } from '@/components/ui/Button';

export type QuoteWizardStep = {
  key: string;
  label: string;
};

type QuoteWizardProgressProps = {
  steps: QuoteWizardStep[];
  currentStep: number;
  furthestStep: number;
  loading: boolean;
  savedAt: string | null;
  autosavedAt: number | null;
  canDiscardAutosave: boolean;
  canSave: boolean;
  onSelectStep: (index: number) => void;
  onSave: () => void;
  onDiscardAutosave: () => void;
};

export function QuoteWizardProgress({
  steps,
  currentStep,
  furthestStep,
  loading,
  savedAt,
  autosavedAt,
  canDiscardAutosave,
  canSave,
  onSelectStep,
  onSave,
  onDiscardAutosave,
}: QuoteWizardProgressProps) {
  const savedLabel = savedAt
    ? `Saved ${new Date(savedAt).toLocaleString()}`
    : autosavedAt
      ? `Autosaved ${new Date(autosavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : 'Not saved yet';

  return (
    <div className="rounded border border-border/60 bg-card/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Quote progress</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{savedLabel}</span>
          {canDiscardAutosave ? (
            <Button type="button" size="sm" variant="ghost" onClick={onDiscardAutosave}>
              Discard autosaved draft
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={loading || !canSave}>
            {loading ? 'Saving…' : 'Save progress'}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <Button
            key={step.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectStep(index)}
            disabled={index > furthestStep || loading}
            className={`rounded-full border px-4 py-2 text-sm ${
              index === currentStep
                ? 'border-primary bg-primary/10 text-primary'
                : index < furthestStep
                  ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="mr-2 text-xs">{index < furthestStep ? '✓' : index + 1}</span>
            {step.label}
          </Button>
        ))}
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-muted">
        <div
          className="h-1 rounded-full bg-primary transition-all"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
