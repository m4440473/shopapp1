'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import { VendorUpsert } from '@/lib/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { canAccessAdmin } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-current-user';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/Textarea';

type Item = {
  id: string;
  name: string;
  url?: string;
  phone?: string;
  notes?: string;
};

type DialogState = { mode: 'create' | 'edit'; data?: Item } | null;

export default function Client({ initial }: { initial: any }) {
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState({ name: '', url: '', phone: '', notes: '' });
  const toast = useToast();
  const user = useCurrentUser();
  const isAdmin = canAccessAdmin(user ?? undefined);

  useEffect(() => {
    if (dialog?.mode === 'edit' && dialog.data) {
      setForm({
        name: dialog.data.name ?? '',
        url: dialog.data.url ?? '',
        phone: dialog.data.phone ?? '',
        notes: dialog.data.notes ?? '',
      });
    } else if (dialog?.mode === 'create') {
      setForm({ name: '', url: '', phone: '', notes: '' });
    }
  }, [dialog]);

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<any>('/api/admin/vendors?' + qs.toString());
    setItems(cursor ? [...items, ...(data.items ?? [])] : data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save() {
    try {
      const payload = VendorUpsert.parse({
        name: form.name,
        url: form.url || undefined,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      });

      if (dialog?.mode === 'edit' && dialog.data) {
        const res = await fetchJson<any>('/api/admin/vendors/' + dialog.data.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems(items.map((i) => (i.id === dialog.data?.id ? res.item : i)));
        toast.push('Vendor updated', 'success');
      } else {
        const res = await fetchJson<any>('/api/admin/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems([res.item, ...items]);
        toast.push('Vendor created', 'success');
      }
      setDialog(null);
    } catch (e: any) {
      toast.push(e.message || 'Validation error', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson<any>('/api/admin/vendors/' + row.id, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== row.id));
    toast.push('Vendor deleted', 'success');
  }

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'url', header: 'URL' },
      { key: 'phone', header: 'Phone' },
      { key: 'notes', header: 'Notes' },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full max-w-xs"
        />
        <Button variant="outline" onClick={() => refresh()}>
          Search
        </Button>
        <div className="flex-1" />
        {isAdmin && <Button onClick={() => setDialog({ mode: 'create' })}>New vendor</Button>}
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
          <Button variant="outline" onClick={() => refresh(nextCursor!)}>
            Load more
          </Button>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit vendor' : 'New vendor'}</DialogTitle>
            <DialogDescription>Store trusted supplier information.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="vendorName">Name</Label>
              <Input
                id="vendorName"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorUrl">URL</Label>
              <Input
                id="vendorUrl"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorPhone">Phone</Label>
              <Input
                id="vendorPhone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorNotes">Notes</Label>
              <Textarea
                id="vendorNotes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional"
              />
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
