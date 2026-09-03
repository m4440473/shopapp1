"use client";

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';

type State = { open: boolean; status: string; reason: string; saving: boolean; error: string | null };

export function OrderStatusChangeDialog({ state, currentStatus, onChange, onSave }: { state: State; currentStatus: string; onChange: (state: State) => void; onSave: () => void }) {
  const close = () => onChange({ open: false, status: currentStatus, reason: '', saving: false, error: null });
  return <Dialog open={state.open} onOpenChange={(open) => onChange({ ...state, open, status: open ? state.status : currentStatus, reason: open ? state.reason : '', error: null })}>
    <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Change order status</DialogTitle><DialogDescription>This is an administrative override. Normal Received, In progress, and Complete changes are derived from part activity.</DialogDescription></DialogHeader>
      <div className="space-y-4"><div className="grid gap-2"><Label htmlFor="order-status-override">Status</Label><Select value={state.status} onValueChange={(status) => onChange({ ...state, status, error: null })}><SelectTrigger id="order-status-override"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RECEIVED">Received</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="COMPLETE">Complete</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="order-status-reason">Reason for status change</Label><Textarea id="order-status-reason" value={state.reason} onChange={(event) => onChange({ ...state, reason: event.target.value, error: null })} placeholder="Why is this administrative override needed?" rows={3} /><p className="text-xs text-muted-foreground">Required. The selected status, administrator, and reason are saved in order history.</p></div>{state.error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div> : null}</div>
      <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={close} disabled={state.saving}>Cancel</Button><Button type="button" onClick={onSave} disabled={state.saving || !state.reason.trim()}>{state.saving ? 'Saving…' : 'Save status'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
