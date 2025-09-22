'use client';
import React, { useMemo, useState } from 'react';
import Table from '@/components/Admin/Table';
import DialogForm from '@/components/Admin/DialogForm';
import ConfirmButton from '@/components/Admin/ConfirmButton';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import { MaterialUpsert } from '@/lib/zod';

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
    const data = await fetchJson<any>('/api/admin/materials?' + qs.toString());
    setItems(cursor ? [...items, ...data.items] : data.items);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save(newData: any) {
    try {
      // client-side zod validation
      const parsed = MaterialUpsert.parse(newData);
      const payload = parsed as any;

      if (editing) {
        const res = await fetchJson<any>('/api/admin/materials/' + editing.id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        setItems(items.map(i => i.id === editing.id ? res.item : i));
        toast.push('Material updated', 'success');
        setEditing(null);
      } else {
        const res = await fetchJson<any>('/api/admin/materials', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        setItems([res.item, ...items]);
        toast.push('Material created', 'success');
        setCreating(false);
      }
    } catch (e: any) {
      toast.push(e.message || 'Validation error', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson<any>('/api/admin/materials/' + row.id, { method: 'DELETE' });
    setItems(items.filter(i => i.id !== row.id));
    toast.push('Material deleted', 'success');
  }

  const columns = useMemo(() => [{ key:'name', header:'Name' }, { key:'spec', header:'Spec' }, { key:'notes', header:'Notes' }], []);

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

      <Table columns={columns as any} rows={items} onEdit={(row)=>setEditing(row)} onDelete={remove} />

      {nextCursor && (
        <div className="flex justify-center">
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800" onClick={() => refresh(nextCursor!)}>Load more</button>
        </div>
      )}

      {(creating || editing) && (
        <DialogForm title={editing ? 'Edit' : 'New'} onClose={() => (setCreating(false), setEditing(null))} onSubmit={async () => { 
          const payload = (function(){const g=(id)=>document.getElementById(id) as HTMLInputElement; return { name: g('name').value.trim(), spec: g('spec').value.trim()||undefined, notes: (document.getElementById('notes') as HTMLTextAreaElement).value.trim()||undefined };})();
          await save(payload);
        }}>
          
          <div className="space-y-2">
            <label className="text-xs">Name<input id="name" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded"/></label>
            <label className="text-xs">Spec<input id="spec" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded"/></label>
            <label className="text-xs">Notes<textarea id="notes" className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded"/></label>
          </div>
    
        </DialogForm>
      )}
    </div>
  );
}
