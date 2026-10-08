'use client';

import { Button } from '@/components/ui/Button';
import type { DurableIntakeDraftHandle, IntakeDraftData } from '@/modules/intake-drafts/durable-intake-draft.types';

export function IntakeDraftStatus<T extends IntakeDraftData>({ draft, onDiscard, disabled = false }: {
  draft: DurableIntakeDraftHandle<T>;
  onDiscard?: () => void;
  disabled?: boolean;
}) {
  const label = draft.reloadRequired ? 'Draft editing is paused. Reload to start from the current server state.'
    : draft.editingBlocked ? 'Finishing draft discard…'
    : !draft.ready ? 'Loading saved draft…'
    : draft.status === 'saving' ? 'Saving draft to server…'
    : draft.status === 'dirty' ? 'Draft changes waiting to save'
    : draft.status === 'error' ? 'Draft has unsaved changes'
    : draft.status === 'conflict' ? 'This draft changed in another window'
    : draft.savedAt ? `Draft saved to server at ${new Date(draft.savedAt).toLocaleTimeString()}` : 'Ready to save your draft';
  return <div className="rounded border border-border/60 bg-card p-3 text-sm" aria-label="Draft recovery">
    <p role="status">{label}</p>
    {draft.error && <p role="alert" className="mt-1 text-red-300">{draft.error}</p>}
    {draft.legacyAvailable && <div className="mt-2">
      <p>An older draft is stored in this browser. Restore it only if it is your work.</p>
      <Button type="button" size="sm" disabled={disabled} onClick={() => void draft.restoreLegacy()}>Restore older browser draft</Button>{' '}
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => draft.discardLegacy()}>Discard older browser draft</Button>
    </div>}
    {!draft.legacyAvailable && <div className="mt-2 flex flex-wrap gap-2">
      {draft.status === 'error' && !draft.reloadRequired && <Button type="button" size="sm" disabled={disabled} onClick={() => void draft.retry()}>{draft.editingBlocked ? 'Retry draft discard' : 'Retry draft save'}</Button>}
      {draft.reloadRequired && onDiscard && <Button type="button" size="sm" disabled={disabled} onClick={() => window.location.reload()}>Reload current server state</Button>}
      {draft.status === 'conflict' && <>
        <Button type="button" size="sm" disabled={disabled} onClick={() => void draft.loadServer()}>Load server draft</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void draft.keepLocal()}>Replace server draft with this version</Button>
      </>}
      {onDiscard && draft.ready && !draft.editingBlocked && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onDiscard}>Discard draft</Button>}
    </div>}
  </div>;
}
