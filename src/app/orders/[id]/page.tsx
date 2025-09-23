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

  return (
    <div className="p-6 min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      <div className="max-w-3xl mx-auto bg-[#121821] p-6 rounded shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">{item.orderNumber}</h1>
            <div className="text-sm text-[#9FB1C1]">Customer: {item.customer?.name ?? '-'}</div>
          </div>
          <div className="text-right text-sm text-[#9FB1C1]">
            <div>Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
            <div>Priority: <span className="font-semibold text-[#E6EDF3]">{item.priority}</span></div>
            <div>Status: <span className="font-semibold text-[#E6EDF3]">{item.status}</span></div>
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

        <h2 className="mt-4 font-semibold">Notes</h2>
        <div className="whitespace-pre-wrap mt-1">{item.notes ?? '-'}</div>
      </div>
    </div>
  );
}
