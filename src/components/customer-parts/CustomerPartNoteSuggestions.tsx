'use client';

import type { CustomerPartNoteSuggestion } from '@/modules/customer-parts/customer-parts.types';
import { Button } from '@/components/ui/Button';

export function appendSuggestedNote(current: string, suggestion: string) {
  const trimmed = suggestion.trim();
  if (!trimmed) return current;
  const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalized(current).includes(normalized(trimmed))) return current;
  return [current.trim(), trimmed].filter(Boolean).join('\n');
}

export function CustomerPartNoteSuggestions({
  suggestions,
  onApply,
}: {
  suggestions: CustomerPartNoteSuggestion[];
  onApply: (suggestion: CustomerPartNoteSuggestion) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-sky-400/30 bg-sky-400/5 p-3">
      <div>
        <p className="text-sm font-semibold">Suggested manufacturing notes</p>
        <p className="text-xs text-muted-foreground">Review the source, then add only the instructions that apply to this run.</p>
      </div>
      {suggestions.map((suggestion) => (
        <div key={suggestion.id} className="rounded-md border border-border/60 bg-background/70 p-3 text-sm">
          <p className="whitespace-pre-wrap text-foreground">{suggestion.text}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {suggestion.sourceLabel}{suggestion.requiresDrawingReview ? ' · verify on drawing' : ' · previously reviewed'}
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestion.evidenceHref ? (
                <a className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted" href={suggestion.evidenceHref} target="_blank" rel="noopener noreferrer">Open source</a>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => onApply(suggestion)}>
                Add to {suggestion.destination === 'workInstructions' ? 'required reading' : 'part notes'}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
