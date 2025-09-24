"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  Package2,
  Printer,
  ChevronDown,
  StickyNote,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/Textarea';

const STATUS_OPTIONS: Array<[string, string]> = [
  ['NEW', 'New'],
  ['PROGRAMMING', 'Programming'],
  ['RUNNING', 'Running'],
  ['INSPECTING', 'Inspecting'],
  ['READY_FOR_ADDONS', 'Ready for addons'],
  ['COMPLETE', 'Complete'],
  ['CLOSED', 'Closed'],
];

const statusColor = (status: string) =>
  ({
    NEW: 'bg-sky-500/20 text-sky-200',
    PROGRAMMING: 'bg-blue-500/20 text-blue-200',
    RUNNING: 'bg-emerald-500/20 text-emerald-200',
    INSPECTING: 'bg-amber-500/20 text-amber-200',
    READY_FOR_ADDONS: 'bg-purple-500/20 text-purple-200',
    COMPLETE: 'bg-teal-500/20 text-teal-200',
    CLOSED: 'bg-zinc-500/20 text-zinc-200',
  }[status] ?? 'bg-muted text-foreground');

export default function OrderDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split('/').pop() ?? '';
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});
  const openPrint = React.useCallback(() => {
    if (!id) return;
    window.open(`/orders/${id}/print`, '_blank', 'noopener,noreferrer');
  }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
      setError(null);
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

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    setExpandedParts({});
  }, [item?.id]);

  async function toggleChecklist(checklistItemId: string, checked: boolean) {
    setToggling(checklistItemId);
    try {
      const res = await fetch(`/api/orders/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItemId, checked }),
        credentials: 'include',
      });
      if (!res.ok) throw res;
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      const res = await fetch(`/api/orders/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText.trim() }),
        credentials: 'include',
      });
      if (!res.ok) throw res;
      setNoteText('');
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function changeStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      if (!res.ok) throw res;
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!item) {
    return <div className="text-muted-foreground">Order not found.</div>;
  }

  const checkedIds = new Set(item.checklist?.map((c: any) => c.checklistItem?.id));
  const parts: any[] = Array.isArray(item.parts) ? item.parts : [];
  const primaryPart = parts[0];
  const additionalParts = parts.slice(1);

  return (
    <div className="relative isolate">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-24 right-1/3 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute top-[45%] -left-32 h-64 w-64 rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-[28%] translate-y-[35%] rounded-full bg-emerald-500/15 blur-[140px]" />
      </div>
      <div className="relative space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Order {item.orderNumber}</h1>
          <p className="text-muted-foreground">
            Customer-facing details, shop routing, and production notes for this work order.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={openPrint}
            className="rounded-full bg-primary/90 text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary"
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Badge className={statusColor(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Customer
              </CardTitle>
              <CardDescription>Contact and shipping details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <span className="font-medium text-foreground">Name</span>
                <div className="text-muted-foreground">{item.customer?.name ?? '-'}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Contact</span>
                <div className="text-muted-foreground">{item.customer?.contact ?? '-'}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Phone</span>
                <div className="text-muted-foreground">{item.customer?.phone ?? '-'}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Email</span>
                <div className="text-muted-foreground">{item.customer?.email ?? '-'}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Address</span>
                <div className="text-muted-foreground whitespace-pre-line">
                  {item.customer?.address ?? '-'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package2 className="h-4 w-4 text-muted-foreground" /> Part overview
              </CardTitle>
              <CardDescription>Primary details for the first line item</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Part #</span>
                <span className="text-muted-foreground">{primaryPart?.partNumber ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Quantity</span>
                <span className="text-muted-foreground">{primaryPart?.quantity ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Material</span>
                <span className="text-muted-foreground">{primaryPart?.material?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Due</span>
                <span className="text-muted-foreground">
                  {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
          {additionalParts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" /> Additional parts
                </CardTitle>
                <CardDescription>Expand each part number to view its full details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {additionalParts.map((part, index) => {
                  const key = part.id ?? `part-${index + 1}`;
                  const isOpen = expandedParts[key] ?? false;
                  const contentId = `part-details-${key}`;
                  const togglePart = () =>
                    setExpandedParts((prev) => ({ ...prev, [key]: !isOpen }));
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-lg border border-border/60 bg-muted/10"
                    >
                      <button
                        type="button"
                        onClick={togglePart}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-muted/20"
                        aria-expanded={isOpen}
                        aria-controls={contentId}
                      >
                        <span>{part.partNumber || `Part ${index + 2}`}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`}
                        />
                      </button>
                      {isOpen && (
                        <div
                          id={contentId}
                          className="grid gap-3 border-t border-border/60 bg-background/70 px-3 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">Part #</span>
                            <span className="text-muted-foreground">{part.partNumber ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">Quantity</span>
                            <span className="text-muted-foreground">{part.quantity ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">Material</span>
                            <span className="text-muted-foreground">{part.material?.name ?? '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">Due</span>
                            <span className="text-muted-foreground">
                              {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                            </span>
                          </div>
                          {part.notes && (
                            <div>
                              <span className="font-medium text-foreground">Notes</span>
                              <p className="mt-1 whitespace-pre-line text-muted-foreground">{part.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> Checklist
              </CardTitle>
              <CardDescription>Track downstream processes and finishing services.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {item.checklist?.map((c: any) => (
                <label
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                >
                  <Checkbox
                    checked={checkedIds.has(c.checklistItem?.id)}
                    disabled={!!toggling}
                    onCheckedChange={(value) =>
                      toggleChecklist(c.checklistItem.id, value === true)
                    }
                  />
                  <div>
                    <div className="font-medium text-foreground">
                      {c.checklistItem?.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(c.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </label>
              ))}
              {(!item.checklist || item.checklist.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No processes assigned. Use the checklist admin to seed standard routing steps.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="h-4 w-4 text-muted-foreground" /> Status management
              </CardTitle>
              <CardDescription>Update the workflow stage for this order.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {STATUS_OPTIONS.map(([value, label]) => (
                <Button
                  key={value}
                  variant={item.status === value ? 'default' : 'outline'}
                  onClick={() => changeStatus(value)}
                  className="justify-between"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 opacity-70" />
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="h-4 w-4 text-muted-foreground" /> Notes
              </CardTitle>
              <CardDescription>Chronological log of updates from the team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-72 space-y-3 overflow-auto rounded-lg border border-border/60 bg-muted/10 p-3">
                {item.notes?.length ? (
                  item.notes.map((note: any) => (
                    <div key={note.id} className="space-y-1 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{note.user?.name ?? 'Unknown'}</span>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-foreground">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a shop note or inspection comment"
                />
                <div className="flex justify-end">
                  <Button onClick={addNote}>Add note</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
              <CardDescription>Every transition is logged for traceability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {item.statusHistory?.length ? (
                item.statusHistory.map((s: any) => (
                  <div key={s.id} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="text-foreground">{s.to}</div>
                    <div className="text-xs">
                      {new Date(s.createdAt).toLocaleString()}
                      {s.reason ? ` — ${s.reason}` : ''}
                    </div>
                  </div>
                ))
              ) : (
                <p>No status changes recorded yet.</p>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              <Link href="/orders" className="hover:underline">
                Back to orders
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
