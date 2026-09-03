'use client';

import { PlusCircle, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export type NewOrderPartEntryMode = 'manual' | 'drawing' | 'existing';

type Props = {
  mode: NewOrderPartEntryMode | null;
  persistentSelection?: boolean;
  existingDescription: string;
  onChoose: (mode: NewOrderPartEntryMode) => void;
};

export function NewOrderPartEntryChooser({ mode, persistentSelection = false, existingDescription, onChoose }: Props) {
  const drawingClass = persistentSelection
    ? `rounded-2xl border-2 p-6 text-left transition ${mode === 'drawing' ? 'border-primary bg-primary/10' : 'border-border bg-background/70 hover:border-primary/50'}`
    : 'rounded-2xl border-2 border-primary bg-primary/10 p-6 text-left transition hover:bg-primary/15';
  const manualClass = persistentSelection
    ? `rounded-2xl border-2 p-6 text-left transition ${mode === 'manual' ? 'border-primary bg-primary/10' : 'border-border bg-background/70 hover:border-primary/50'}`
    : 'rounded-2xl border border-border bg-background/70 p-6 text-left transition hover:border-primary/50';
  const existingClass = persistentSelection
    ? `rounded-2xl border-2 p-6 text-left transition ${mode === 'existing' ? 'border-sky-400 bg-sky-400/10' : 'border-border bg-background/70 hover:border-sky-400/70'}`
    : 'rounded-2xl border border-border bg-background/70 p-6 text-left transition hover:border-sky-400/70';

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle>How would you like to add the parts?</CardTitle>
        <CardDescription>Read new drawings, reuse a proven customer part, or type the details yourself.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => onChoose('drawing')} className={drawingClass}>
          <Upload className="mb-4 h-8 w-8 text-primary" />
          <span className="block text-xl font-semibold text-foreground">Read drawings for me</span>
          <span className="mt-2 block text-sm text-muted-foreground">Upload one drawing or a ZIP. We will fill in the parts and show you anything that needs checking.</span>
          <span className="mt-4 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Recommended</span>
        </button>
        <button type="button" onClick={() => onChoose('manual')} className={manualClass}>
          <PlusCircle className="mb-4 h-8 w-8 text-muted-foreground" />
          <span className="block text-xl font-semibold text-foreground">Type parts myself</span>
          <span className="mt-2 block text-sm text-muted-foreground">Continue with the familiar manual part-entry screen.</span>
        </button>
        <button type="button" onClick={() => onChoose('existing')} className={existingClass}>
          <PlusCircle className="mb-4 h-8 w-8 text-sky-300" />
          <span className="block text-xl font-semibold text-foreground">Choose a preexisting part</span>
          <span className="mt-2 block text-sm text-muted-foreground">{existingDescription}</span>
        </button>
      </CardContent>
    </Card>
  );
}
