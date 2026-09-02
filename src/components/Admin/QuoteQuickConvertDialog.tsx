"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';

const PRIORITIES = ['LOW', 'NORMAL', 'RUSH', 'HOT'] as const;

type Priority = (typeof PRIORITIES)[number];

type MachinistOption = { id: string; name: string };

type QuickConvertPayload = {
  dueDate: string;
  priority: Priority;
  assignedMachinistId?: string;
  assignedWorkerIds: string[];
  poNumber?: string;
};

export function validateQuickConvertPayload(input: {
  dueDate: string;
  priority: string;
  assignedMachinistId: string;
  assignedWorkerIds: string[];
  poNumber: string;
}): { payload: QuickConvertPayload | null; error: string | null } {
  if (!input.dueDate.trim()) {
    return { payload: null, error: 'Due date is required.' };
  }

  const parsedDueDate = new Date(input.dueDate);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return { payload: null, error: 'Provide a valid due date.' };
  }

  const priority = PRIORITIES.includes(input.priority as Priority) ? (input.priority as Priority) : 'NORMAL';

  const payload: QuickConvertPayload = {
    dueDate: input.dueDate.trim(),
    priority,
    assignedWorkerIds: Array.from(new Set(input.assignedWorkerIds.map((id) => id.trim()).filter(Boolean))),
  };

  if (input.assignedMachinistId.trim()) {
    payload.assignedMachinistId = input.assignedMachinistId.trim();
  }

  if (input.poNumber.trim()) {
    payload.poNumber = input.poNumber.trim();
  }

  return { payload, error: null };
}

interface QuoteQuickConvertDialogProps {
  quoteId: string;
  disabled?: boolean;
  disabledReason?: string;
  initialDueDate?: string | null;
  initialPriority?: string | null;
  initialAssignedMachinistId?: string | null;
  initialPoNumber?: string | null;
  /** Retained for compatibility with existing callers; sourcing is derived during conversion. */
  initialVendorId?: string | null;
  initialMaterialNeeded?: boolean;
  initialMaterialOrdered?: boolean;
  initialModelIncluded?: boolean;
}

export default function QuoteQuickConvertDialog({
  quoteId,
  disabled = false,
  disabledReason,
  initialDueDate,
  initialPriority,
  initialAssignedMachinistId,
  initialPoNumber,
}: QuoteQuickConvertDialogProps) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [machinists, setMachinists] = React.useState<MachinistOption[]>([]);
  const [loadingMachinists, setLoadingMachinists] = React.useState(false);

  const [dueDate, setDueDate] = React.useState(initialDueDate ?? '');
  const [priority, setPriority] = React.useState<Priority>(
    PRIORITIES.includes((initialPriority ?? '') as Priority) ? (initialPriority as Priority) : 'NORMAL',
  );
  const [assignedMachinistId, setAssignedMachinistId] = React.useState(initialAssignedMachinistId ?? '');
  const [assignedWorkerIds, setAssignedWorkerIds] = React.useState<string[]>([]);
  const [poNumber, setPoNumber] = React.useState(initialPoNumber ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || machinists.length > 0) return;
    setLoadingMachinists(true);
    fetch('/api/admin/users?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const next = rows
          .filter((m: any) => m?.active !== false && m?.role !== 'VIEWER')
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.email || 'Unnamed employee',
          }));
        setMachinists(next);
      })
      .catch(() => setMachinists([]))
      .finally(() => setLoadingMachinists(false));
  }, [open, machinists.length]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/admin/quotes/${quoteId}/detect-po`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const detected = typeof data?.poNumber === 'string' ? data.poNumber.trim() : '';
        if (!active || !detected) return;
        setPoNumber((current) => current.trim() ? current : detected);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, quoteId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const { payload, error: validationError } = validateQuickConvertPayload({
      dueDate,
      priority,
      assignedMachinistId,
      assignedWorkerIds,
      poNumber,
    });

    if (validationError || !payload) {
      setError(validationError || 'Missing required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchJson<{ orderId: string }>(`/api/admin/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.push('Order created from quote.', 'success');
      setOpen(false);
      router.push(`/orders/${response.orderId}`);
      router.refresh();
    } catch (submitError: any) {
      const message =
        submitError?.body?.error || submitError?.message || 'Failed to create the order. Please review the fields and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} title={disabledReason ?? 'Create an order from this quote'}>
          Create Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>
              Confirm the final scheduling details. Parts, drawings, material decisions, and work steps will carry over from the quote.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="quick-convert-due-date">Due date</Label>
              <Input
                id="quick-convert-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-convert-priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger id="quick-convert-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="quick-convert-machinist">Coordinator (optional)</Label>
              <Select
                value={assignedMachinistId || '__none__'}
                onValueChange={(value) => setAssignedMachinistId(value === '__none__' ? '' : value)}
              >
                <SelectTrigger id="quick-convert-machinist">
                  <SelectValue
                    placeholder={loadingMachinists ? 'Loading machinists…' : 'Select coordinator'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No coordinator</SelectItem>
                  {machinists.map((machinist) => (
                    <SelectItem key={machinist.id} value={machinist.id}>
                      {machinist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label>Assigned workers (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Selected workers will be assigned to every part and can be adjusted per part later.
              </p>
              <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-2">
                {machinists.length ? (
                  machinists.map((machinist) => {
                    const checked = assignedWorkerIds.includes(machinist.id);
                    return (
                      <label key={machinist.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setAssignedWorkerIds((current) =>
                              value === true
                                ? Array.from(new Set([...current, machinist.id]))
                                : current.filter((id) => id !== machinist.id),
                            )
                          }
                        />
                        <span className="text-sm">{machinist.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No active employees are available.</p>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="quick-convert-po-number">PO number (optional)</Label>
              <Input
                id="quick-convert-po-number"
                value={poNumber}
                onChange={(event) => setPoNumber(event.target.value)}
                placeholder="PO-12345"
              />
            </div>

          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingMachinists}>
              {submitting ? 'Creating…' : 'Create order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
