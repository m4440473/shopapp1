'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import { UserUpsert } from '@/lib/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Item {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
}

type DialogState = { mode: 'create' | 'edit'; data?: Item } | null;

export default function Client({ initial }: { initial: any }) {
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'MACHINIST', active: 'true' });
  const toast = useToast();

  useEffect(() => {
    if (dialog?.mode === 'edit' && dialog.data) {
      setForm({
        name: dialog.data.name ?? '',
        email: dialog.data.email ?? '',
        role: dialog.data.role ?? 'MACHINIST',
        active: dialog.data.active ? 'true' : 'false',
      });
    } else if (dialog?.mode === 'create') {
      setForm({ name: '', email: '', role: 'MACHINIST', active: 'true' });
    }
  }, [dialog]);

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<any>('/api/admin/users?' + qs.toString());
    setItems(cursor ? [...items, ...(data.items ?? [])] : data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save() {
    try {
      const payload = UserUpsert.parse({
        name: form.name || undefined,
        email: form.email,
        role: form.role,
        active: form.active === 'true',
      });

      if (dialog?.mode === 'edit' && dialog.data) {
        const res = await fetchJson<any>('/api/admin/users/' + dialog.data.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems(items.map((i) => (i.id === dialog.data?.id ? res.item : i)));
        toast.push('User updated', 'success');
      } else {
        const res = await fetchJson<any>('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems([res.item, ...items]);
        toast.push('User created', 'success');
      }
      setDialog(null);
    } catch (e: any) {
      toast.push(e.message || 'Validation error', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson<any>('/api/admin/users/' + row.id, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== row.id));
    toast.push('User deleted', 'success');
  }

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role' },
      {
        key: 'active',
        header: 'Active',
        render: (value: any) => (value ? 'true' : 'false'),
      },
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
        <Button onClick={() => setDialog({ mode: 'create' })}>New user</Button>
      </div>

      <Table
        columns={columns as any}
        rows={items}
        onEdit={(row) => setDialog({ mode: 'edit', data: row })}
        onDelete={remove}
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
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit user' : 'New user'}</DialogTitle>
            <DialogDescription>Manage access for internal users.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="userName">Name</Label>
              <Input
                id="userName"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="userRole">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="userRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MACHINIST">MACHINIST</SelectItem>
                    <SelectItem value="VIEWER">VIEWER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="userActive">Active</Label>
                <Select
                  value={form.active}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
                >
                  <SelectTrigger id="userActive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
