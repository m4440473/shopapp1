"use client";
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

export default function OrderDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split('/').pop() ?? '';
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
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
      const res = await fetch(`/api/orders/${id}/checklist`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ checklistItemId, checked }), credentials: 'include' });
      if (!res.ok) throw res;
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
  const parts = item.parts ?? [];

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      const res = await fetch(`/api/orders/${id}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content: noteText.trim() }), credentials: 'include' });
      if (!res.ok) throw res;
      setNoteText('');
      await load();
    } catch (e) { console.error(e); }
  }

  async function changeStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }), credentials: 'include' });
      if (!res.ok) throw res;
      await load();
    } catch (e) { console.error(e); }
  }

  return (
    <div className="p-6 min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      <div className="max-w-6xl mx-auto bg-[#121821] p-6 rounded shadow" style={{display:'grid', gridTemplateColumns: '320px 1fr', gap: '24px'}}>
        {/* Left sidebar */}
        <aside style={{paddingRight:12}}>
          <div className="card">
            <h3 className="font-semibold">Customer Details</h3>
            <div className="kv mt-2">
              <div className="kvt">Name</div><div>{item.customer?.name ?? '-'}</div>
              <div className="kvt">Contact</div><div>{item.customer?.contact ?? '-'}</div>
              <div className="kvt">Phone</div><div>{item.customer?.phone ?? '-'}</div>
              <div className="kvt">Email</div><div>{item.customer?.email ?? '-'}</div>
              <div className="kvt">Address</div><div className="text-sm">{item.customer?.address ?? '-'}</div>
            </div>
          </div>

          <div className="card mt-4">
            <h3 className="font-semibold">Order</h3>
            <div className="kv mt-2">
              <div className="kvt">Order #</div><div>{item.orderNumber}</div>
              <div className="kvt">Due</div><div>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
            </div>
          </div>

          <div className="card mt-4">
            <h3 className="font-semibold">Parts</h3>
            {parts.length === 0 ? (
              <div className="text-sm text-[#9FB1C1] mt-2">No parts recorded.</div>
            ) : parts.length === 1 ? (
              <div className="kv mt-2">
                <div className="kvt">Part #</div><div>{parts[0]?.partNumber ?? '-'}</div>
                <div className="kvt">Quantity</div><div>{parts[0]?.quantity ?? '-'}</div>
                <div className="kvt">Material</div><div>{parts[0]?.material?.name ?? '-'}</div>
                {parts[0]?.notes && <><div className="kvt">Notes</div><div className="text-sm">{parts[0].notes}</div></>}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {parts.map((part:any, idx:number) => (
                  <details key={part.id ?? idx}>
                    <summary>{`Part ${idx + 1}: ${part.partNumber || 'N/A'} • Qty: ${part.quantity ?? '-'}`}</summary>
                    <div className="kv mt-3">
                      <div className="kvt">Part #</div><div>{part.partNumber ?? '-'}</div>
                      <div className="kvt">Quantity</div><div>{part.quantity ?? '-'}</div>
                      <div className="kvt">Material</div><div>{part.material?.name ?? '-'}</div>
                      {part.notes && <><div className="kvt">Notes</div><div className="text-sm">{part.notes}</div></>}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="card mt-4">
            <h3 className="font-semibold">Processes</h3>
            <div className="mt-2" style={{display:'grid', gridTemplateColumns:'1fr', gap:6}}>
              {item.checklist?.map((c:any) => (
                <label key={c.id} className="flex items-center" style={{gap:8}}>
                  <input type="checkbox" className="w-4 h-4" checked={checkedIds.has(c.checklistItem?.id)} disabled={!!toggling} onChange={e => toggleChecklist(c.checklistItem.id, e.target.checked)} />
                  <span className="text-sm">{c.checklistItem?.label}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Right area: single column with Status & Notes stacked */}
        <div>
          <Card>
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
                <Button key={val as string} className="w-full" onClick={() => changeStatus(val as string)}>{label}</Button>
              ))}
            </div>
          </Card>

          <Card className="mt-4">
            <div className="font-semibold">Notes</div>
            <div className="mt-2 max-h-[360px] overflow-auto">
              <ul>
                {item.notes?.map((n:any) => (
                  <li key={n.id} className="mb-3">
                    <div className="text-sm text-[#9FB1C1]">{n.user?.name ?? 'Unknown'} • {new Date(n.createdAt).toLocaleString()}</div>
                    <div className="text-sm whitespace-pre-wrap">{n.content}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <Textarea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." />
              <div className="toolbar">
                <Button onClick={addNote}>Add Note</Button>
              </div>
            </div>
          </Card>

          <Card className="mt-4">
            <div className="font-semibold">Status History</div>
            <div className="mt-2 text-sm text-[#9FB1C1]">
              <ul>
                {item.statusHistory?.map((s:any) => (
                  <li key={s.id} className="mb-2">{new Date(s.createdAt).toLocaleString()} — <strong>{s.to}</strong> {s.reason ? `— ${s.reason}` : ''}</li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
