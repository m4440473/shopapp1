'use client';

import React, { useEffect, useMemo, useState } from 'react';

import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchJson } from '@/lib/fetchJson';
import { canAccessAdmin } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-current-user';
import { AddonUpsert } from '@/lib/zod';
import { formatWorkItemRateLabel, type WorkItemRateType } from '@/modules/pricing/work-item-pricing';

interface Department {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface Item {
  id: string;
  name: string;
  description?: string | null;
  rateType: WorkItemRateType;
  rateCents: number;
  active: boolean;
  affectsPrice: boolean;
  isChecklistItem: boolean;
  departmentId: string;
  department?: Department | null;
}

interface ClientProps {
  initial: { items: Item[]; nextCursor: string | null };
}

type DialogState = { mode: 'create' | 'edit'; data?: Item } | null;

const RATE_LABEL: Record<Item['rateType'], string> = {
  HOURLY: 'Hourly',
  FLAT: 'Flat rate',
  PER_FOOT: 'Per foot',
};

type WorkStepUsage = 'SHOP_AND_PRICE' | 'SHOP_ONLY' | 'PRICE_ONLY';

const USAGE_OPTIONS: Array<{ value: WorkStepUsage; label: string; detail: string }> = [
  {
    value: 'SHOP_AND_PRICE',
    label: 'Shop task + include in price',
    detail: 'Workers see this step, and its rate is included in the quote.',
  },
  {
    value: 'SHOP_ONLY',
    label: 'Shop task only (no charge)',
    detail: 'Workers see this step, but it does not add to the quote price.',
  },
  {
    value: 'PRICE_ONLY',
    label: 'Price only (do not show in shop)',
    detail: 'The estimator can charge for it without adding a shop task.',
  },
];

function usageFromFlags(item: Pick<Item, 'affectsPrice' | 'isChecklistItem'>): WorkStepUsage {
  if (item.isChecklistItem && item.affectsPrice) return 'SHOP_AND_PRICE';
  if (item.isChecklistItem) return 'SHOP_ONLY';
  if (item.affectsPrice) return 'PRICE_ONLY';
  // Normalize legacy "neither" records without unexpectedly adding a charge.
  return 'SHOP_ONLY';
}

function flagsFromUsage(usage: WorkStepUsage) {
  return {
    affectsPrice: usage !== 'SHOP_ONLY',
    isChecklistItem: usage !== 'PRICE_ONLY',
  };
}

function usageLabel(item: Pick<Item, 'affectsPrice' | 'isChecklistItem'>) {
  const usage = usageFromFlags(item);
  return USAGE_OPTIONS.find((option) => option.value === usage)?.label ?? usage;
}

export default function Client({ initial }: ClientProps) {
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    rateType: 'HOURLY' as Item['rateType'],
    rate: '0.00',
    active: true,
    usage: 'SHOP_AND_PRICE' as WorkStepUsage,
    departmentId: '',
  });
  const toast = useToast();
  const user = useCurrentUser();
  const isAdmin = canAccessAdmin(user ?? undefined);

  useEffect(() => {
    fetchJson<{ items: Department[] }>('/api/admin/departments')
      .then((data) => setDepartments(data.items ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (dialog?.mode === 'edit' && dialog.data) {
      setForm({
        name: dialog.data.name,
        description: dialog.data.description ?? '',
        rateType: dialog.data.rateType,
        rate: (dialog.data.rateCents / 100).toFixed(2),
        active: dialog.data.active,
        usage: usageFromFlags(dialog.data),
        departmentId: dialog.data.departmentId,
      });
    } else if (dialog?.mode === 'create') {
      setForm({
        name: '',
        description: '',
        rateType: 'HOURLY',
        rate: '0.00',
        active: true,
        usage: 'SHOP_AND_PRICE',
        departmentId: '',
      });
    }
  }, [dialog]);

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      {
        key: 'rateType',
        header: 'Billing',
        render: (value: Item['rateType']) => RATE_LABEL[value] ?? value,
      },
      {
        key: 'rateCents',
        header: 'Price',
        render: (_: number, row: Item) =>
          row.affectsPrice ? formatWorkItemRateLabel(row) : 'Not included in price',
      },
      {
        key: 'usage',
        header: 'Used for',
        render: (_: unknown, row: Item) => usageLabel(row),
      },
      {
        key: 'active',
        header: 'Active',
        render: (value: boolean) => (value ? 'Yes' : 'No'),
      },
      {
        key: 'department',
        header: 'Department',
        render: (_: Department | null, row: Item) => row.department?.name ?? '—',
      },
      {
        key: 'description',
        header: 'Description',
      },
    ],
    []
  );

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<{ items: Item[]; nextCursor: string | null }>(
      `/api/admin/addons?${qs.toString()}`
    );
    setItems(cursor ? [...items, ...(data.items ?? [])] : data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save() {
    let rateCents = 0;
    try {
      const parsedRate = Number.parseFloat(form.rate);
      if (Number.isNaN(parsedRate) || parsedRate < 0) {
        throw new Error('Enter a valid rate in dollars');
      }
      rateCents = Math.round(parsedRate * 100);
    } catch (error: any) {
      toast.push(error.message ?? 'Invalid rate', 'error');
      return;
    }

    const usageFlags = flagsFromUsage(form.usage);
    const payload = AddonUpsert.parse({
      name: form.name,
      description: form.description || undefined,
      rateType: form.rateType,
      rateCents,
      active: form.active,
      affectsPrice: usageFlags.affectsPrice,
      isChecklistItem: usageFlags.isChecklistItem,
      departmentId: form.departmentId,
    });

    try {
      if (dialog?.mode === 'edit' && dialog.data) {
        const res = await fetchJson<{ item: Item }>(`/api/admin/addons/${dialog.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems(items.map((i) => (i.id === dialog.data?.id ? res.item : i)));
        toast.push('Work step updated', 'success');
      } else {
        const res = await fetchJson<{ item: Item }>(`/api/admin/addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems([res.item, ...items]);
        toast.push('Work step created', 'success');
      }
      setDialog(null);
    } catch (error: any) {
      toast.push(error.message || 'Failed to save work step', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson(`/api/admin/addons/${row.id}`, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== row.id));
    toast.push('Work step deleted', 'success');
  }

  const selectableDepartments = useMemo(() => {
    const active = departments.filter((department) => department.isActive);
    if (dialog?.mode === 'edit' && form.departmentId) {
      const selected = departments.find((department) => department.id === form.departmentId);
      if (selected && !selected.isActive) {
        return [selected, ...active];
      }
    }
    return active;
  }, [departments, dialog?.mode, form.departmentId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search work steps"
          className="w-full max-w-xs"
        />
        <Button variant="outline" onClick={() => refresh()}>
          Search
        </Button>
        <div className="flex-1" />
        {isAdmin && <Button onClick={() => setDialog({ mode: 'create' })}>New work step</Button>}
      </div>

      <Table
        columns={columns as any}
        rows={items}
        onEdit={(row) => setDialog({ mode: 'edit', data: row })}
        onDelete={remove}
        actionsEnabled={isAdmin}
      />

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => refresh(nextCursor)}>
            Load more
          </Button>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit work step' : 'New work step'}</DialogTitle>
            <DialogDescription>
              Choose where this step is used. The app will handle its shop and pricing behavior for you.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="addonName">Step name</Label>
              <Input
                id="addonName"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Example: Deburr, machine, inspect, or package"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workStepUsage">How is this step used?</Label>
              <select
                id="workStepUsage"
                value={form.usage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, usage: event.target.value as WorkStepUsage }))
                }
                className="min-h-11 rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {USAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {USAGE_OPTIONS.find((option) => option.value === form.usage)?.detail}
              </p>
            </div>
            {form.usage !== 'SHOP_ONLY' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="addonRateType">How to charge</Label>
                  <select
                    id="addonRateType"
                    value={form.rateType}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, rateType: event.target.value as Item['rateType'] }))
                    }
                    className="min-h-11 rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="HOURLY">Per hour</option>
                    <option value="PER_FOOT">Per foot</option>
                    <option value="FLAT">Flat amount</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addonRate">Rate (USD)</Label>
                  <Input
                    id="addonRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rate}
                    onChange={(event) => setForm((prev) => ({ ...prev, rate: event.target.value }))}
                    required
                  />
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                This step will appear for the shop, but it will not add anything to the quote price.
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="addonDepartment">Department</Label>
              <select
                id="addonDepartment"
                value={form.departmentId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, departmentId: event.target.value }))
                }
                className="rounded border border-border bg-background px-3 py-2 text-sm"
                required
              >
                <option value="" disabled>
                  Select department
                </option>
                {selectableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                    {!department.isActive ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addonDescription">Description</Label>
              <Textarea
                id="addonDescription"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Optional guidance about when this step should be used"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="addonActive"
                checked={form.active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: Boolean(checked) }))}
              />
              <Label htmlFor="addonActive" className="text-sm font-normal">
                Available on new quotes and orders
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
