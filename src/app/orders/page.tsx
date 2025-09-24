"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const SORT_KEYS = ['receivedDate', 'dueDate', 'priority', 'status'] as const;

function statusColor(status: string) {
  const map: Record<string,string> = {
    RECEIVED: '#6B7280', PROGRAMMING: '#60A5FA', SETUP: '#22D3EE', RUNNING: '#34D399', FINISHING: '#F59E0B', DONE_MACHINING: '#A78BFA', INSPECTION: '#F97316', SHIPPING: '#EAB308', CLOSED: '#10B981'
  };
  return map[status] ?? '#64748B';
}

export default function OrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('receivedDate');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [machinists, setMachinists] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  async function load(cursor?: string, append = false) {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set('take','20');
      if (cursor) qs.set('cursor', cursor);
      const res = await fetch('/api/orders?' + qs.toString());
      if (!res.ok) throw res;
      const data = await res.json();
      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setNextCursor(data.nextCursor ?? null);
    } catch (err:any) {
      try { const j = await err.json(); setError(JSON.stringify(j)); } catch { setError('Failed to load orders'); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // load machinists for assignment
  useEffect(() => {
    fetch('/api/admin/users?role=MACHINIST&take=100')
      .then(r => r.ok ? r.json() : Promise.resolve({ items: [] }))
      .then(d => setMachinists(d.items ?? []))
      .catch(() => setMachinists([]));
  }, []);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (!SORT_KEYS.includes(sortKey as any)) return arr;
    arr.sort((a,b) => {
      const A = a[sortKey]; const B = b[sortKey];
      if (!A && !B) return 0; if (!A) return 1; if (!B) return -1;
      if (sortKey === 'dueDate' || sortKey === 'receivedDate') {
        return (new Date(A).getTime() - new Date(B).getTime()) * (sortDir==='asc'?1:-1);
      }
      return String(A).localeCompare(String(B)) * (sortDir==='asc'?1:-1);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  async function assign(orderId:string, machinistId:string) {
    const res = await fetch(`/api/orders/${orderId}/assign`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ machinistId }) });
    if (res.ok) {
      const j = await res.json();
      setItems(prev => prev.map(it => it.id === j.item.id ? j.item : it));
    }
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#9FB1C1]">Sort</label>
              <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="bg-[#121821] p-2 rounded">
                <option value="receivedDate">Received Date</option>
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
              </select>
              <button onClick={() => setSortDir(d => d==='asc'?'desc':'asc')} className="px-2 py-1 rounded border">{sortDir==='asc'?'↑':'↓'}</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#9FB1C1]">View</span>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded border text-sm ${viewMode === 'table' ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'border-[#1F2937] text-[#9FB1C1]'}`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-1 rounded border text-sm ${viewMode === 'card' ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'border-[#1F2937] text-[#9FB1C1]'}`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-red-400">{error}</div>}

        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sorted.map(o => (
              <div key={o.id} className="bg-[rgba(18,24,33,0.6)] p-4 rounded border border-[rgba(255,255,255,0.03)] shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/orders/${o.id}`} className="text-[#34D399] text-lg font-medium">{o.orderNumber}</Link>
                    <div className="text-sm text-[#9FB1C1]">{o.customer?.name ?? '-'}</div>
                    <div className="text-xs text-[#9FB1C1] mt-1">Received: {o.receivedDate ? new Date(o.receivedDate).toLocaleDateString() : '-'}</div>
                  </div>
                  <div className="text-right">
                    <div style={{background: statusColor(o.status)}} className="text-black px-2 py-1 rounded text-xs font-semibold">{o.status}</div>
                    <div className="text-xs text-[#9FB1C1]">Due: {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '-'}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm">Priority: <span className="font-semibold">{o.priority}</span></div>
                  <div className="flex items-center gap-2">
                    <select value={o.assignedMachinist?.id ?? ''} onChange={e => assign(o.id, e.target.value)} className="bg-[#0F1720] p-1 rounded text-sm">
                      <option value="">Assign machinist</option>
                      {machinists.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[#9FB1C1] border-b border-[rgba(255,255,255,0.06)]">
                  <th className="py-2 pr-3">Order #</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Received</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Machinist</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(o => (
                  <tr key={o.id} className="border-b border-[rgba(255,255,255,0.04)]">
                    <td className="py-3 pr-3">
                      <Link href={`/orders/${o.id}`} className="text-[#34D399] font-medium">{o.orderNumber}</Link>
                    </td>
                    <td className="py-3 pr-3">{o.customer?.name ?? '-'}</td>
                    <td className="py-3 pr-3">{o.receivedDate ? new Date(o.receivedDate).toLocaleDateString() : '-'}</td>
                    <td className="py-3 pr-3">{o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '-'}</td>
                    <td className="py-3 pr-3">{o.priority}</td>
                    <td className="py-3 pr-3">
                      <span style={{ background: statusColor(o.status) }} className="text-black px-2 py-1 rounded text-xs font-semibold inline-block">{o.status}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <select value={o.assignedMachinist?.id ?? ''} onChange={e => assign(o.id, e.target.value)} className="bg-[#0F1720] p-1 rounded text-sm">
                        <option value="">Assign machinist</option>
                        {machinists.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center mt-6">
            <button className="px-4 py-2 rounded bg-[#1F2937]" onClick={() => load(nextCursor, true)}>Load more</button>
          </div>
        )}
      </div>
    </div>
  );
}
