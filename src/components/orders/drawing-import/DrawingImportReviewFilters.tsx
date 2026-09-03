'use client';

import type { DrawingImportReviewFilter } from './drawing-import-ui.types';

const OPTIONS: Array<{ value: DrawingImportReviewFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'unreadable', label: 'Unreadable' },
  { value: 'conflicting', label: 'Conflicts' },
  { value: 'uncertain', label: 'Uncertain' },
  { value: 'duplicate', label: 'Duplicates' },
  { value: 'failed', label: 'Failed' },
];

export function DrawingImportReviewFilters({
  value,
  counts,
  onChange,
}: {
  value: DrawingImportReviewFilter;
  counts: Record<DrawingImportReviewFilter, number>;
  onChange: (value: DrawingImportReviewFilter) => void;
}) {
  return (
    <label className="flex max-w-xs items-center gap-2 text-sm" aria-label="Filter drawing review pages">
      <span className="font-medium">Show</span>
      <select className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-foreground dark:[color-scheme:dark]" value={value} onChange={(event) => onChange(event.target.value as DrawingImportReviewFilter)}>
        {OPTIONS.map((option) => <option className="bg-background text-foreground" key={option.value} value={option.value}>{option.label} ({counts[option.value]})</option>)}
      </select>
    </label>
  );
}
