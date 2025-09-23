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
  const [noteError, setNoteError] = useState<string | null>(null);

        <div>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-lg">Status</div>
              <div className="text-sm text-[#9FB1C1]">Current: <span className="font-semibold text-[#E6EDF3]">{item.status}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                ['NEW','New'],
                ['PROGRAMMING','Programming'],
                ['RUNNING','Running'],
          // ...existing logic and hooks...
          // ...functions: load, toggleChecklist, addNote, changeStatus...
          // ...checkedIds...

          if (loading) return <div className="p-6">Loading...</div>;
          if (error) return <div className="p-6 text-red-400">{error}</div>;
          if (!item) return <div className="p-6">Order not found</div>;

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
                  await load();
                } catch (e) {
                  console.error(e);
                } finally {
                  setToggling(null);
                }
              }

              const checkedIds = new Set(item?.checklist?.map((c:any) => c.checklistItem?.id));

              async function addNote() {
                setNoteError(null);
                if (!noteText.trim()) return;
                try {
                  const res = await fetch(`/api/orders/${id}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content: noteText.trim() }), credentials: 'include' });
                  if (!res.ok) {
                    let errorMsg = 'Failed to add note';
                    try {
                      const errJson = await res.json();
                      errorMsg = errJson.error || errorMsg;
                    } catch {}
                    setNoteError(errorMsg);
                    return;
                  }
                  setNoteText('');
                  await load();
                } catch (e) {
                  setNoteError('Network error');
                  console.error(e);
                }
              }

              async function changeStatus(newStatus: string) {
                try {
                  const res = await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }), credentials: 'include' });
                  if (!res.ok) throw res;
                  await load();
                } catch (e) {
                  console.error(e);
                }
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
  // All logic and hooks above
  // Only one return statement below
  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!item) return <div className="p-6">Order not found</div>;

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
            <h3 className="font-semibold">Part</h3>
            <div className="kv mt-2">
              <div className="kvt">Part #</div><div>{item.parts?.[0]?.partNumber ?? '-'}</div>
              <div className="kvt">Quantity</div><div>{item.parts?.[0]?.quantity ?? '-'}</div>
              <div className="kvt">Material</div><div>{item.parts?.[0]?.material?.name ?? '-'}</div>
            </div>
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
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-lg">Status</div>
              <div className="text-sm text-[#9FB1C1]">Current: <span className="font-semibold text-[#E6EDF3]">{item.status}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                ['NEW','New'],
                ['PROGRAMMING','Programming'],
                ['RUNNING','Running'],
                ['INSPECTING','Inspecting'],
                ['READY_FOR_ADDONS','Ready for addons'],
                ['COMPLETE','Complete'],
                ['CLOSED','Closed']
              ].map(([val,label]) => (
                <Button
                  key={val as string}
                  className="w-full py-2 rounded-md bg-[#2D3748] text-[#A0AEC0] hover:bg-[#3B4252] hover:text-[#E6EDF3] border border-[#232B3A] transition"
                  onClick={() => changeStatus(val as string)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="mt-4">
            <div className="font-semibold text-lg mb-2">Notes</div>
            <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-0 mb-6" style={{maxHeight:'260px', overflow:'auto'}}>
              <div className="divide-y divide-[#232B3A]">
                {item.notes?.length ? (
                  item.notes.map((n:any) => (
                    <div key={n.id} className="flex items-start gap-3 p-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#232B3A] flex items-center justify-center text-[#9FB1C1] font-bold text-sm">
                        {n.user?.name ? n.user.name.split(' ').map((w:string) => w[0]).join('').toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#E6EDF3]">{n.user?.name ?? 'Unknown'}</span>
                          <span className="text-xs text-[#9FB1C1]">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-[#C7D4E2] whitespace-pre-wrap">{n.content}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-[#9FB1C1] text-sm">No notes yet.</div>
                )}
              </div>
            </div>

            <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-4">
              <div className="flex items-center gap-3">
                <Textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." className="flex-1 resize-none bg-[#232B3A] text-[#E6EDF3] border-none focus:ring-2 focus:ring-[#3B82F6]" />
                <Button onClick={addNote} className="px-5 py-2 text-base font-semibold bg-[#2D3748] text-[#A0AEC0] hover:bg-[#3B4252] hover:text-[#E6EDF3] border border-[#232B3A] transition">Add Note</Button>
              </div>
              {noteError && <div className="text-red-400 mt-2 text-sm font-medium">{noteError}</div>}
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
                      </div>
                    </div>

                    <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-4">
                      <div className="flex items-center gap-3">
                        <Textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." className="flex-1 resize-none bg-[#232B3A] text-[#E6EDF3] border-none focus:ring-2 focus:ring-[#3B82F6]" />
                        <Button onClick={addNote} className="px-5 py-2 text-base font-semibold bg-[#2D3748] text-[#A0AEC0] hover:bg-[#3B4252] hover:text-[#E6EDF3] border border-[#232B3A] transition">Add Note</Button>
                      </div>
                      {noteError && <div className="text-red-400 mt-2 text-sm font-medium">{noteError}</div>}
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
                    console.error(e);
                  } finally {
                    setToggling(null);
                  }
                }

                const checkedIds = new Set(item?.checklist?.map((c:any) => c.checklistItem?.id));

                async function addNote() {
                  setNoteError(null);
                  if (!noteText.trim()) return;
                  try {
                    const res = await fetch(`/api/orders/${id}/notes`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content: noteText.trim() }), credentials: 'include' });
                    if (!res.ok) {
                      let errorMsg = 'Failed to add note';
                      try {
                        const errJson = await res.json();
                        errorMsg = errJson.error || errorMsg;
                      } catch {}
                      setNoteError(errorMsg);
                      return;
                    }
                    setNoteText('');
                    await load();
                  } catch (e) {
                    setNoteError('Network error');
                    console.error(e);
                  }
                }

                async function changeStatus(newStatus: string) {
                  try {
                    const res = await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }), credentials: 'include' });
                    if (!res.ok) throw res;
                    await load();
                  } catch (e) {
                    console.error(e);
                  }
                }

                if (loading) return <div className="p-6">Loading...</div>;
                if (error) return <div className="p-6 text-red-400">{error}</div>;
                if (!item) return <div className="p-6">Order not found</div>;

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
                          <h3 className="font-semibold">Part</h3>
                          <div className="kv mt-2">
                            <div className="kvt">Part #</div><div>{item.parts?.[0]?.partNumber ?? '-'}</div>
                            <div className="kvt">Quantity</div><div>{item.parts?.[0]?.quantity ?? '-'}</div>
                            <div className="kvt">Material</div><div>{item.parts?.[0]?.material?.name ?? '-'}</div>
                          </div>
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
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-lg">Status</div>
                            <div className="text-sm text-[#9FB1C1]">Current: <span className="font-semibold text-[#E6EDF3]">{item.status}</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {[
                              ['NEW','New'],
                              ['PROGRAMMING','Programming'],
                              ['RUNNING','Running'],
                              ['INSPECTING','Inspecting'],
                              ['READY_FOR_ADDONS','Ready for addons'],
                              ['COMPLETE','Complete'],
                              ['CLOSED','Closed']
                            ].map(([val,label]) => (
                              <Button
                                key={val as string}
                                className="w-full py-2 rounded-md bg-[#2D3748] text-[#A0AEC0] hover:bg-[#3B4252] hover:text-[#E6EDF3] border border-[#232B3A] transition"
                                onClick={() => changeStatus(val as string)}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </Card>

                        <Card className="mt-4">
                          <div className="font-semibold text-lg mb-2">Notes</div>
                          <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-0 mb-6" style={{maxHeight:'260px', overflow:'auto'}}>
                            <div className="divide-y divide-[#232B3A]">
                              {item.notes?.length ? (
                                item.notes.map((n:any) => (
                                  <div key={n.id} className="flex items-start gap-3 p-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#232B3A] flex items-center justify-center text-[#9FB1C1] font-bold text-sm">
                                      {n.user?.name ? n.user.name.split(' ').map((w:string) => w[0]).join('').toUpperCase() : 'U'}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-[#E6EDF3]">{n.user?.name ?? 'Unknown'}</span>
                                        <span className="text-xs text-[#9FB1C1]">{new Date(n.createdAt).toLocaleString()}</span>
                                      </div>
                                      <div className="text-sm text-[#C7D4E2] whitespace-pre-wrap">{n.content}</div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-4 text-[#9FB1C1] text-sm">No notes yet.</div>
                              )}
                            </div>
                          </div>

                          <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-4">
                            <div className="flex items-center gap-3">
                              <Textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." className="flex-1 resize-none bg-[#232B3A] text-[#E6EDF3] border-none focus:ring-2 focus:ring-[#3B82F6]" />
                              <Button onClick={addNote} className="px-5 py-2 text-base font-semibold bg-[#2D3748] text-[#A0AEC0] hover:bg-[#3B4252] hover:text-[#E6EDF3] border border-[#232B3A] transition">Add Note</Button>
                            </div>
                            {noteError && <div className="text-red-400 mt-2 text-sm font-medium">{noteError}</div>}
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
                  item.notes.map((n:any) => (
                    <div key={n.id} className="flex items-start gap-3 p-4">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#232B3A] flex items-center justify-center text-[#9FB1C1] font-bold text-base">
                        {n.user?.name ? n.user.name.split(' ').map((w:string) => w[0]).join('').toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#E6EDF3]">{n.user?.name ?? 'Unknown'}</span>
                          <span className="text-xs text-[#9FB1C1]">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-[#C7D4E2] whitespace-pre-wrap">{n.content}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-[#9FB1C1] text-sm">No notes yet.</div>
                )}
              </div>
            </div>

            <div className="border border-[#232B3A] rounded-xl bg-[#181F2A] p-4">
              <div className="flex items-start gap-3">
                <Textarea rows={3} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." className="flex-1 resize-none bg-[#232B3A] text-[#E6EDF3] border-none focus:ring-2 focus:ring-[#3B82F6]" />
                <Button onClick={addNote} className="ml-2 px-5 py-2 text-base font-semibold">Add Note</Button>
              </div>
              {noteError && <div className="text-red-400 mt-2 text-sm font-medium">{noteError}</div>}
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
