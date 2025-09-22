'use client';
import React, { useMemo, useState } from 'react';
import Table from '@/components/Admin/Table';
import DialogForm from '@/components/Admin/DialogForm';
import ConfirmButton from '@/components/Admin/ConfirmButton';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import { UserUpsert } from '@/lib/zod';

type Item = any;

export default function Client({ initial }: { initial: any }) {
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<any>('/api/admin/users?' + qs.toString());
    setItems(cursor ? [...items, ...data.items] : data.items);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save(newData: any) {
    try {
      // client-side zod validation
      const parsed = UserUpsert.parse(newData);
      const payload = parsed as any;

      if (editing) {
        const res = await fetchJson<any>('/api/admin/users/' + editing.id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        setItems(items.map(i => i.id === editing.id ? res.item : i));
        toast.push('User updated', 'success');
        setEditing(null);
      } else {
        const res = await fetchJson<any>('/api/admin/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        setItems([res.item, ...items]);
        toast.push('User created', 'success');
        setCreating(false);
      }
    } catch (e: any) {
      toast.push(e.message || 'Validation error', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson<any>('/api/admin/users/' + row.id, { method: 'DELETE' });
    setItems(items.filter(i => i.id !== row.id));
    toast.push('User deleted', 'success');
  }

  const columns = useMemo(() => [{ key:'name', header:'Name' }, { key:'email', header:'Email' }, { key:'role', header:'Role' }, { key:'active', header:'Active' }], []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search"
          className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm w-64"
        />
        <button className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20" onClick={() => refresh()}>
          Search
        </button>
        <div className="flex-1" />
        <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800" onClick={() => setCreating(true)}>
          New
        </button>
      </div>

      <Table columns={columns as any} rows={items} onEdit={(row)=>setEditing(row)}  />

      {nextCursor && (
        <div className="flex justify-center">
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800" onClick={() => refresh(nextCursor!)}>Load more</button>
        </div>
      )}

      {(creating || editing) && (
        <DialogForm title={editing ? 'Edit' : 'New'} onClose={() => (setCreating(false), setEditing(null))} onSubmit={async () => { 
          const payload = (function(){const g=(id)=>document.getElementById(id) as HTMLInputElement; return { name: g('name').value.trim()||undefined, email: g('email').value.trim(), role: (document.getElementById('role') as HTMLSelectElement).value, active: (document.getElementById('active') as HTMLSelectElement).value==='true' };})();
          await save(payload);
        }}>
          
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Name<input id="name" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded"/></label>
              <label className="text-xs">Email<input id="email" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded" placeholder="user@example.com"/></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Role
                <select id="role" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded">
                  <option value="MACHINIST">MACHINIST</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label className="text-xs">Active
                <select id="active" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded">
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
            </div>
          </div>
    
        </DialogForm>
      )}
    </div>
  );
}
