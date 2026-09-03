'use client';

import { Button } from '@/components/ui/Button';

export type NewOrderWizardStep = { key: string; label: string };

export function NewOrderWizardProgress({ steps, currentStep, disabled, onSelect }: {
  steps: NewOrderWizardStep[];
  currentStep: number;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="rounded border border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <Button key={step.key} type="button" variant="outline" size="sm" onClick={() => onSelect(index)} disabled={disabled} className={`rounded-full border px-4 py-2 text-sm ${index === currentStep ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
            <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>{step.label}
          </Button>
        ))}
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-muted">
        <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

export function NewOrderWizardNavigation({ currentStep, stepCount, nextDisabled, onBack, onNext }: {
  currentStep: number;
  stepCount: number;
  nextDisabled: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  if (currentStep >= stepCount - 1) return null;
  return (
    <div className="flex items-center justify-between">
      <Button type="button" variant="ghost" onClick={onBack} disabled={currentStep === 0}>Back</Button>
      <Button type="button" disabled={nextDisabled} onClick={onNext}>Next</Button>
    </div>
  );
}
