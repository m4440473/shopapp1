"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function OrderDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split('/').pop() ?? '';
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
    } catch (err: any) {
      try {
        const json = await err.json();
        setError(JSON.stringify(json));
      } catch {
        setError('Failed to fetch order');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function toggleChecklist(checklistItemId: string, checked: boolean) {
    setToggling(checklistItemId);
    try {
      await fetch(`/api/orders/${id}/checklist`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ checklistItemId, checked }) });
      // refresh
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!item) return <div className="p-6">Order not found</div>;

  const checkedIds = new Set(item.checklist?.map((c:any) => c.checklistItem?.id));

  const [noteText, setNoteText] = useState('');

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      await fetch(`/api/orders/${id}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content: noteText.trim() }) });
      setNoteText('');
      await load();
    } catch (e) { console.error(e); }
  }

  async function changeStatus(newStatus: string) {
    try {
      await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
      await load();
    } catch (e) { console.error(e); }
  }

  return (
    <div className="p-6 min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      <div className="max-w-4xl mx-auto bg-[#121821] p-6 rounded shadow grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-1">{item.orderNumber}</h1>
              <div className="text-sm text-[#9FB1C1]">{item.customer?.name ?? '-'}</div>
              <div className="text-xs text-[#9FB1C1] mt-1">{item.customer?.contact ?? ''} • {item.customer?.phone ?? ''} • {item.customer?.email ?? ''}</div>
              <div className="text-xs text-[#9FB1C1] mt-1">{item.customer?.address ?? ''}</div>
            </div>
            <div className="text-sm text-[#9FB1C1] text-right">
              <div>Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
              <div>Received: {item.receivedDate ? new Date(item.receivedDate).toLocaleDateString() : '-'}</div>
            </div>
          </div>

          <h2 className="mt-6 font-semibold">Parts</h2>
          <ul className="list-disc ml-5">
            {item.parts?.map((p:any) => (
              <li key={p.id}>{p.partNumber} × {p.quantity} {p.material ? `(${p.material.name})` : ''}</li>
            ))}
          </ul>

          <h2 className="mt-4 font-semibold">Checklist</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {item.checklist?.map((c:any) => (
              <label key={c.id} className="flex items-center gap-3 bg-[#0F1720] p-2 rounded">
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={checkedIds.has(c.checklistItem?.id)}
                  disabled={!!toggling}
                  onChange={e => toggleChecklist(c.checklistItem.id, e.target.checked)}
                />
                <div className="flex-1">
                  <div className="font-medium text-[#E6EDF3]">{c.checklistItem?.label}</div>
                  <div className="text-xs text-[#9FB1C1]">{c.toggledById ? `Toggled by ${c.toggledById}` : ''}</div>
                </div>
              </label>
            ))}
          </div>

          <h2 className="mt-4 font-semibold">Status History</h2>
          <ul>
            {item.statusHistory?.map((s:any) => (
              <li key={s.id}>{new Date(s.createdAt).toLocaleString()} — {s.to} — {s.reason ?? ''}</li>
            ))}
          </ul>
        </div>

        <aside>
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Status</div>
              <div className="text-sm text-[#9FB1C1]">Current: <span className="font-semibold text-[#E6EDF3]">{item.status}</span></div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                ['NEW','New'],
                ['PROGRAMMING','Programming'],
                ['RUNNING','Running'],
                ['INSPECTING','Inspecting'],
                ['READY_FOR_ADDONS','Ready for addons'],
                ['COMPLETE','Complete'],
                ['CLOSED','Closed']
              ].map(([val,label]) => (
                <button key={val as string} className="btn w-full" onClick={() => changeStatus(val as string)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="card mt-4">
            <div className="font-semibold">Notes</div>
            <div className="mt-2 max-h-48 overflow-auto">
              {(item.statusHistory || []).concat(item.notes?[]:[])}
              <ul>
                {item.notesList?.map((n:any) => (
                  <li key={n.id} className="mb-2">
                    <div className="text-sm text-[#9FB1C1]">{n.user?.name ?? 'Unknown'} • {new Date(n.createdAt).toLocaleString()}</div>
                    <div className="text-sm">{n.content}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <textarea className="w-full shp" rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." />
              <div className="toolbar">
                <button className="btn" onClick={addNote}>Add Note</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
