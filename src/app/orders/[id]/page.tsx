"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function OrderDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split('/').pop() ?? '';
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/orders/${id}`)
      .then(res => {
        if (!res.ok) throw res;
        return res.json();
      })
      .then(data => setItem(data.item))
      .catch(async (err) => {
        try {
          const json = await err.json();
          setError(JSON.stringify(json));
        } catch {
          setError('Failed to fetch order');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!item) return <div className="p-6">Order not found</div>;

  return (
    <div className="p-6 min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      <div className="max-w-3xl mx-auto bg-[#121821] p-6 rounded">
        <h1 className="text-xl font-semibold mb-2">Order {item.orderNumber}</h1>
        <div className="text-sm text-[#9FB1C1] mb-4">Customer: {item.customer?.name ?? '-'}</div>
        <div className="grid grid-cols-2 gap-4">
          <div>Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
          <div>Priority: {item.priority}</div>
          <div>Status: {item.status}</div>
          <div>Received: {item.receivedDate ? new Date(item.receivedDate).toLocaleDateString() : '-'}</div>
        </div>

        <h2 className="mt-4 font-semibold">Parts</h2>
        <ul>
          {item.parts?.map((p:any) => (
            <li key={p.id}>{p.partNumber} × {p.quantity} {p.material ? `(${p.material.name})` : ''}</li>
          ))}
        </ul>

        <h2 className="mt-4 font-semibold">Checklist</h2>
        <ul>
          {item.checklist?.map((c:any) => (
            <li key={c.id}>{c.checklistItem?.label}</li>
          ))}
        </ul>

        <h2 className="mt-4 font-semibold">Status History</h2>
        <ul>
          {item.statusHistory?.map((s:any) => (
            <li key={s.id}>{new Date(s.createdAt).toLocaleString()} — {s.to} — {s.reason ?? ''}</li>
          ))}
        </ul>

        <h2 className="mt-4 font-semibold">Notes</h2>
        <div>{item.notes ?? '-'}</div>
      </div>
    </div>
  );
}
