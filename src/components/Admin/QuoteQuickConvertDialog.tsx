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
  assignedMachinistId: string;
  poNumber?: string;
  vendorId?: string;
  materialNeeded?: boolean;
  materialOrdered?: boolean;
  modelIncluded?: boolean;
};

export function validateQuickConvertPayload(input: {
  dueDate: string;
  priority: string;
  assignedMachinistId: string;
  poNumber: string;
  vendorId: string;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
}): { payload: QuickConvertPayload | null; error: string | null } {
  if (!input.dueDate.trim()) {
    return { payload: null, error: 'Due date is required.' };
  }

  if (!input.assignedMachinistId.trim()) {
    return { payload: null, error: 'Assigned machinist is required.' };
  }

  const parsedDueDate = new Date(input.dueDate);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return { payload: null, error: 'Provide a valid due date.' };
  }

  const priority = PRIORITIES.includes(input.priority as Priority) ? (input.priority as Priority) : 'NORMAL';

  const payload: QuickConvertPayload = {
    dueDate: input.dueDate,
    priority,
    assignedMachinistId: input.assignedMachinistId,
    materialNeeded: input.materialNeeded,
    materialOrdered: input.materialOrdered,
    modelIncluded: input.modelIncluded,
  };

  if (input.poNumber.trim()) {
    payload.poNumber = input.poNumber.trim();
  }

  if (input.vendorId.trim()) {
    payload.vendorId = input.vendorId.trim();
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
  initialVendorId,
  initialMaterialNeeded = false,
  initialMaterialOrdered = false,
  initialModelIncluded = false,
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
  const [poNumber, setPoNumber] = React.useState(initialPoNumber ?? '');
  const [vendorId, setVendorId] = React.useState(initialVendorId ?? '');
  const [materialNeeded, setMaterialNeeded] = React.useState(Boolean(initialMaterialNeeded));
  const [materialOrdered, setMaterialOrdered] = React.useState(Boolean(initialMaterialOrdered));
  const [modelIncluded, setModelIncluded] = React.useState(Boolean(initialModelIncluded));
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || machinists.length > 0) return;
    setLoadingMachinists(true);
    fetch('/api/admin/users?role=MACHINIST&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const next = rows.map((m: any) => ({
          id: m.id,
          name: m.name || m.email || 'Unnamed machinist',
        }));
        setMachinists(next);
        if (!assignedMachinistId && next[0]?.id) {
          setAssignedMachinistId(next[0].id);
        }
      })
      .catch(() => setMachinists([]))
      .finally(() => setLoadingMachinists(false));
  }, [open, machinists.length, assignedMachinistId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const { payload, error: validationError } = validateQuickConvertPayload({
      dueDate,
      priority,
      assignedMachinistId,
      poNumber,
      vendorId,
      materialNeeded,
      materialOrdered,
      modelIncluded,
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
      toast.push('Quote converted to order.', 'success');
      setOpen(false);
      router.push(`/orders/${response.orderId}`);
      router.refresh();
    } catch (submitError: any) {
      const message =
        submitError?.body?.error || submitError?.message || 'Failed to convert quote. Please review the fields and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} title={disabledReason ?? 'Convert quote to order'}>
          Quick Convert
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Quick Convert Quote</DialogTitle>
            <DialogDescription>
              Confirm required order details and convert immediately. This path skips review pricing controls.
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
              <Label htmlFor="quick-convert-machinist">Assigned machinist</Label>
              <Select value={assignedMachinistId || undefined} onValueChange={setAssignedMachinistId}>
                <SelectTrigger id="quick-convert-machinist">
                  <SelectValue
                    placeholder={loadingMachinists ? 'Loading machinists…' : 'Select machinist'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {machinists.map((machinist) => (
                    <SelectItem key={machinist.id} value={machinist.id}>
                      {machinist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-convert-po-number">PO number (optional)</Label>
              <Input
                id="quick-convert-po-number"
                value={poNumber}
                onChange={(event) => setPoNumber(event.target.value)}
                placeholder="PO-12345"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-convert-vendor-id">Vendor id (optional)</Label>
              <Input
                id="quick-convert-vendor-id"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                placeholder="Vendor ID"
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-border p-3">
            <Label className="text-sm">Material flags</Label>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={materialNeeded} onCheckedChange={(checked) => setMaterialNeeded(Boolean(checked))} />
              Material needed
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={materialOrdered} onCheckedChange={(checked) => setMaterialOrdered(Boolean(checked))} />
              Material ordered
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={modelIncluded} onCheckedChange={(checked) => setModelIncluded(Boolean(checked))} />
              Model included
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingMachinists}>
              {submitting ? 'Converting…' : 'Convert now'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
