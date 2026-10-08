'use client';

import { Button } from '@/components/ui/Button';

export function PendingSubmissionRecovery({ busy, onCheck, onRetry }: {
  busy: boolean;
  onCheck: () => void;
  onRetry: () => void;
}) {
  return <div className="rounded border border-amber-500/50 bg-amber-500/10 p-4 text-sm" aria-label="Submission recovery">
    <p>Your submission is saved. Confirm its result before changing this draft.</p>
    <p className="mt-1">Retry sends the same saved request and recovers the original result if it was already created.</p>
    <div className="mt-3 flex gap-2">
      <Button type="button" disabled={busy} onClick={onCheck}>Check saved submission</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onRetry}>{busy ? 'Checking…' : 'Retry saved submission'}</Button>
    </div>
  </div>;
}
