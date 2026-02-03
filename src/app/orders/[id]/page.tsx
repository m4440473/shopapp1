"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  FileText,
  ListChecks,
  Timer,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';

const PART_TABS = ['overview', 'notes', 'checklist', 'log'] as const;
const PART_ATTACHMENT_KINDS = ['DWG', 'STEP', 'PDF', 'PO', 'IMAGE', 'OTHER'] as const;

type PartTab = (typeof PART_TABS)[number];

type AttachmentFormState = {
  label: string;
  url: string;
  mimeType: string;
  storagePath: string;
  kind: (typeof PART_ATTACHMENT_KINDS)[number];
  uploading: boolean;
};

type ConflictState = {
  open: boolean;
  activeEntry: any | null;
  activeOrder: any | null;
  activePart: any | null;
  elapsedSeconds: number;
};

const formatDuration = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const formatMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
};

const statusBadgeStyles: Record<string, string> = {
  COMPLETE: 'bg-emerald-500/15 text-emerald-200',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-200',
};

export default function OrderDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split('/').pop() ?? '';
  const toast = useToast();
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PartTab>('overview');
  const [noteText, setNoteText] = useState('');
  const [canEditParts, setCanEditParts] = useState(false);
  const [partEvents, setPartEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [activePart, setActivePart] = useState<any | null>(null);
  const [partTotals, setPartTotals] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  const [conflictState, setConflictState] = useState<ConflictState>({
    open: false,
    activeEntry: null,
    activeOrder: null,
    activePart: null,
    elapsedSeconds: 0,
  });
  const [attachmentForm, setAttachmentForm] = useState<AttachmentFormState>({
    label: '',
    url: '',
    mimeType: '',
    storagePath: '',
    kind: 'STEP',
    uploading: false,
  });
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentFileKey, setAttachmentFileKey] = useState(0);
  const [attachmentFileName, setAttachmentFileName] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistOverrides, setChecklistOverrides] = useState<Record<string, boolean>>({});

  const parts = Array.isArray(item?.parts) ? item.parts : [];
  const partIdsParam = useMemo(() => parts.map((part: any) => part.id).filter(Boolean).join(','), [parts]);
  const selectedPart = useMemo(
    () => parts.find((part: any) => part?.id === selectedPartId) ?? null,
    [parts, selectedPartId]
  );
  const selectedChecklist = useMemo(() => {
    if (!selectedPartId) return [];
    const items = Array.isArray(item?.checklist) ? item.checklist : [];
    return items.filter((entry: any) => entry.isActive !== false && entry.partId === selectedPartId);
  }, [item?.checklist, selectedPartId]);

  const selectedAttachments = useMemo(() => {
    if (!selectedPartId) return [];
    const attachments = Array.isArray(item?.partAttachments) ? item.partAttachments : [];
    return attachments.filter((attachment: any) => attachment.partId === selectedPartId);
  }, [item?.partAttachments, selectedPartId]);

  const activeElapsedSeconds = useMemo(() => {
    if (!activeEntry?.startedAt) return 0;
    const started = new Date(activeEntry.startedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  }, [activeEntry?.startedAt, tick]);

  useEffect(() => {
    const interval = activeEntry ? window.setInterval(() => setTick((prev) => prev + 1), 1000) : null;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [activeEntry]);

  const load = React.useCallback(async () => {
    if (!id) return null;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
      setCanEditParts(Boolean(data?.permissions?.canEditParts));
      setError(null);
      return data.item;
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
    return null;
  }, [id]);

  const loadPartEvents = React.useCallback(async () => {
    if (!id || !selectedPartId) return;
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/events`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setPartEvents(Array.isArray(data?.events) ? data.events : []);
    } catch {
      setPartEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [id, selectedPartId]);

  const refreshTimerSummary = React.useCallback(async () => {
    if (!id) return;
    setTimerLoading(true);
    try {
      const params = new URLSearchParams();
      if (partIdsParam) {
        params.set('orderId', id);
        params.set('partIds', partIdsParam);
      }
      const res = await fetch(`/api/timer/active?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setActiveEntry(data.activeEntry ?? null);
      setActivePart(data.activePart ?? null);
      setPartTotals(data.totals ?? {});
      setTimerError(null);
    } catch {
      setTimerError('Failed to load timer status.');
    } finally {
      setTimerLoading(false);
    }
  }, [id, partIdsParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!parts.length) {
      setSelectedPartId(null);
      return;
    }
    if (!selectedPartId || !parts.some((part: any) => part.id === selectedPartId)) {
      setSelectedPartId(parts[0].id);
    }
  }, [parts, selectedPartId]);

  useEffect(() => {
    refreshTimerSummary();
  }, [refreshTimerSummary]);

  useEffect(() => {
    loadPartEvents();
  }, [loadPartEvents]);

  const handleStart = async () => {
    if (!id || !selectedPartId) return;
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, partId: selectedPartId }),
        credentials: 'include',
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflictState({
          open: true,
          activeEntry: data.activeEntry ?? null,
          activeOrder: data.activeOrder ?? null,
          activePart: data.activePart ?? null,
          elapsedSeconds: data.elapsedSeconds ?? 0,
        });
        return;
      }
      if (!res.ok) throw res;
      await refreshTimerSummary();
      await loadPartEvents();
    } catch {
      setTimerError('Failed to start timer.');
    } finally {
      setTimerSaving(false);
    }
  };

  const handlePause = async () => {
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/pause', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw res;
      await refreshTimerSummary();
      await loadPartEvents();
    } catch {
      setTimerError('Failed to pause timer.');
    } finally {
      setTimerSaving(false);
    }
  };

  const handleFinish = async () => {
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/finish', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw res;
      await load();
      await refreshTimerSummary();
      await loadPartEvents();
    } catch {
      setTimerError('Failed to finish timer.');
    } finally {
      setTimerSaving(false);
    }
  };

  const handleConflictAction = async (action: 'pause' | 'finish') => {
    setConflictState((prev) => ({ ...prev, open: false }));
    if (action === 'pause') {
      await handlePause();
    } else {
      await handleFinish();
    }
    await handleStart();
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedPartId) return;
    try {
      const res = await fetch(`/api/orders/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText.trim(), partId: selectedPartId }),
        credentials: 'include',
      });
      if (!res.ok) throw res;
      setNoteText('');
      await load();
      await loadPartEvents();
    } catch {
      // ignore
    }
  };

  const handleAttachmentFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !selectedPartId) return;

    setAttachmentForm((prev) => ({ ...prev, uploading: true }));
    setAttachmentError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/orders/parts/${selectedPartId}/attachments/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw res;
      const result = await res.json().catch(() => ({}));

      setAttachmentForm((prev) => ({
        ...prev,
        storagePath: typeof result?.storagePath === 'string' ? result.storagePath : '',
        url: '',
        label: prev.label || result?.label || file.name,
        mimeType: prev.mimeType || result?.mimeType || file.type || '',
        uploading: false,
      }));
      setAttachmentFileName(file.name);
    } catch {
      setAttachmentError('Failed to upload attachment.');
      setAttachmentForm((prev) => ({ ...prev, uploading: false }));
    }
  };

  const handleAddAttachment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPartId) return;
    if (attachmentForm.uploading) {
      setAttachmentError('Wait for the file upload to finish.');
      return;
    }
    const url = attachmentForm.url.trim();
    const storagePath = attachmentForm.storagePath.trim();
    if (!url && !storagePath) {
      setAttachmentError('Add a link or upload a file.');
      return;
    }
    setAttachmentSaving(true);
    setAttachmentError(null);
    try {
      const payload: Record<string, unknown> = {
        kind: attachmentForm.kind,
        label: attachmentForm.label.trim() || undefined,
        mimeType: attachmentForm.mimeType.trim() || undefined,
      };
      if (storagePath) {
        payload.storagePath = storagePath;
      } else {
        payload.url = url;
      }

      const res = await fetch(`/api/orders/parts/${selectedPartId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw res;

      setAttachmentForm({
        label: '',
        url: '',
        mimeType: '',
        storagePath: '',
        kind: 'STEP',
        uploading: false,
      });
      setAttachmentFileKey((prev) => prev + 1);
      setAttachmentFileName(null);
      await load();
      await loadPartEvents();
    } catch {
      setAttachmentError('Failed to attach file.');
    } finally {
      setAttachmentSaving(false);
    }
  };

  const handleChecklistToggle = async (entry: any, checked: boolean) => {
    if (!selectedPartId) return;
    setChecklistError(null);
    setChecklistOverrides((prev) => ({ ...prev, [entry.id]: checked }));
    try {
      const res = await fetch(`/api/orders/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId: entry.id,
          checked,
          partId: selectedPartId,
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const message =
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'Failed to toggle checklist item.';
        throw new Error(message);
      }
      await load();
      await loadPartEvents();
    } catch (err: any) {
      const message = err?.message || 'Failed to toggle checklist item.';
      setChecklistOverrides((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      setChecklistError(message);
      toast.push(message, 'error');
      return;
    }
    setChecklistOverrides((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
  };

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

  const orderTitle = `Order ${item.orderNumber}`;
  const dueDateLabel = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'TBD';
  const statusLabel = item.status?.replace(/_/g, ' ') ?? 'Unknown';
  const activeOnSelected = Boolean(activeEntry?.partId && activeEntry.partId === selectedPartId);

  return (
    <div className="space-y-6">
      <Dialog open={conflictState.open} onOpenChange={(open) => setConflictState((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Active timer already running</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              You already have an active timer for{' '}
              <span className="font-medium text-foreground">
                {conflictState.activeOrder?.orderNumber || 'another order'}
              </span>
              {conflictState.activePart?.partNumber
                ? ` · ${conflictState.activePart.partNumber}`
                : ''}
              .
            </p>
            <p>Elapsed: {formatDuration(conflictState.elapsedSeconds)}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConflictState((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleConflictAction('pause')}>
              Pause &amp; Switch
            </Button>
            <Button type="button" onClick={() => void handleConflictAction('finish')}>
              Finish &amp; Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="flex flex-col">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Work</div>
                <div className="text-sm font-medium text-foreground">
                  {selectedPart?.partNumber || 'No part selected'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeEntry
                    ? `Elapsed ${formatDuration(activeElapsedSeconds)}`
                    : 'No active timer'}
                </div>
                {activeEntry && activeEntry.partId !== selectedPartId ? (
                  <div className="text-xs text-amber-600">
                    Active on {activePart?.partNumber || 'another part'}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedPartId || timerSaving || activeOnSelected}
                  onClick={handleStart}
                >
                  Start
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!activeEntry || timerSaving} onClick={handlePause}>
                  Pause
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!activeEntry || timerSaving} onClick={handleFinish}>
                  Finish
                </Button>
              </div>
            </div>
            {timerError ? (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {timerError}
              </div>
            ) : null}
          </div>
          <CardContent className="flex-1 space-y-3 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Parts</span>
              {timerLoading ? <span>Refreshing…</span> : null}
            </div>
            <div className="space-y-2">
              {parts.map((part: any, index: number) => {
                const isSelected = part.id === selectedPartId;
                const partLabel = part.partNumber || `Part ${index + 1}`;
                const totalMinutes = partTotals[part.id];
                const status = part.status || 'IN_PROGRESS';
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setSelectedPartId(part.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/60 bg-muted/10 hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{partLabel}</div>
                        <div className="text-xs text-muted-foreground">Qty {part.quantity ?? 1}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusBadgeStyles[status] || 'bg-muted text-foreground'}>{status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {Number.isFinite(totalMinutes) ? formatMinutes(totalMinutes) : '—'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{orderTitle}</div>
                <div className="text-2xl font-semibold text-foreground">{item.customer?.name ?? 'Customer'}</div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/orders">Exit Order</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-primary/10 text-primary">{statusLabel}</Badge>
              <span className="text-sm text-muted-foreground">Due {dueDateLabel}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap rounded-md bg-muted/20 p-1">
              {PART_TABS.map((tab) => {
                const label =
                  tab === 'overview'
                    ? 'Overview'
                    : tab === 'notes'
                      ? 'Notes & Files'
                      : tab === 'checklist'
                        ? 'To-do / Checklist'
                        : 'Log';
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`inline-flex items-center h-9 rounded-md px-3 text-sm font-medium transition ${
                      isActive
                        ? 'bg-background text-foreground shadow-sm border border-border/40'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Part</div>
                    <div className="text-base font-medium text-foreground">
                      {selectedPart?.partNumber || 'Select a part'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                    <div className="text-foreground">{selectedPart?.notes || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
                    <div className="text-foreground">{item.customer?.name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Quantity</div>
                    <div className="text-foreground">{selectedPart?.quantity ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Stock length</div>
                    <div className="text-foreground">{selectedPart?.stockSize || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Cut length</div>
                    <div className="text-foreground">{selectedPart?.cutLength || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Material</div>
                    <div className="text-foreground">{selectedPart?.material?.name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Priority</div>
                    <div className="text-foreground">{item.priority ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Due date</div>
                    <div className="text-foreground">{dueDateLabel}</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" /> Notes
                  </div>
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
                      <Button size="sm" onClick={handleAddNote}>
                        Add note
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Files
                  </div>
                  <div className="space-y-3">
                    {selectedAttachments.length ? (
                      selectedAttachments.map((attachment: any) => {
                        const openHref = attachment.storagePath
                          ? `/attachments/${attachment.storagePath}`
                          : attachment.url;
                        return (
                          <div
                            key={attachment.id}
                            className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                          >
                            <div className="font-medium text-foreground">{attachment.label || 'Attachment'}</div>
                            <div className="text-xs text-muted-foreground">{attachment.mimeType || 'Unknown type'}</div>
                            {openHref ? (
                              <a
                                href={openHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                              >
                                Open file
                              </a>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No files yet for this part.</p>
                    )}
                  </div>
                  <Separator />
                  {canEditParts ? (
                    <form className="space-y-3" onSubmit={handleAddAttachment}>
                      <div className="grid gap-2">
                        <Label htmlFor="attachment-kind">File type</Label>
                        <Select
                          value={attachmentForm.kind}
                          onValueChange={(value) =>
                            setAttachmentForm((prev) => ({
                              ...prev,
                              kind: value as AttachmentFormState['kind'],
                            }))
                          }
                        >
                          <SelectTrigger id="attachment-kind" className="border-border/60 bg-background/80 text-left">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PART_ATTACHMENT_KINDS.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {kind}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="attachment-label">Label</Label>
                        <Input
                          id="attachment-label"
                          value={attachmentForm.label}
                          onChange={(e) => {
                            setAttachmentForm((prev) => ({ ...prev, label: e.target.value }));
                            setAttachmentError(null);
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="attachment-mime">Mime type</Label>
                        <Input
                          id="attachment-mime"
                          value={attachmentForm.mimeType}
                          onChange={(e) => {
                            setAttachmentForm((prev) => ({ ...prev, mimeType: e.target.value }));
                            setAttachmentError(null);
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="attachment-url">External link</Label>
                        <Input
                          id="attachment-url"
                          value={attachmentForm.url}
                          onChange={(e) => {
                            setAttachmentForm((prev) => ({
                              ...prev,
                              url: e.target.value,
                              storagePath: e.target.value.trim().length ? '' : prev.storagePath,
                            }));
                            setAttachmentError(null);
                          }}
                          placeholder="Paste a shared link"
                          disabled={attachmentForm.uploading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="attachment-file">Upload file</Label>
                        <Input
                          key={attachmentFileKey}
                          id="attachment-file"
                          type="file"
                          className="bg-background/80"
                          onChange={(e) => void handleAttachmentFile(e.target.files)}
                          disabled={attachmentForm.uploading}
                        />
                        <p className="text-xs text-muted-foreground">
                          {attachmentForm.uploading ? 'Uploading…' : attachmentFileName ? `Selected: ${attachmentFileName}` : 'Drop a file to upload.'}
                        </p>
                      </div>
                      {attachmentError ? (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {attachmentError}
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <Button size="sm" type="submit" disabled={attachmentSaving || attachmentForm.uploading}>
                          {attachmentSaving ? 'Attaching…' : 'Add file'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                      Admin access required to upload files.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ListChecks className="h-4 w-4 text-muted-foreground" /> To-do / Checklist
                </div>
                {checklistError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {checklistError}
                  </div>
                ) : null}
                {selectedChecklist.length ? (
                  selectedChecklist.map((entry: any) => {
                    const label = entry.charge?.name ?? entry.addon?.name ?? 'Checklist item';
                    const checkedValue =
                      typeof checklistOverrides[entry.id] === 'boolean'
                        ? checklistOverrides[entry.id]
                        : Boolean(entry.completed);
                    return (
                      <label
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checkedValue}
                            onCheckedChange={(checked) => handleChecklistToggle(entry, checked === true)}
                          />
                          <div>
                            <div className="font-medium text-foreground">{label}</div>
                            {entry.addon?.description ? (
                              <div className="text-xs text-muted-foreground">{entry.addon.description}</div>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.completed ? 'Done' : 'Open'}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No checklist items for this part.</p>
                )}
              </div>
            )}

            {activeTab === 'log' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Timer className="h-4 w-4 text-muted-foreground" /> Part log
                </div>
                {eventsLoading ? (
                  <div className="text-xs text-muted-foreground">Loading log…</div>
                ) : partEvents.length ? (
                  partEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{event.user?.name || event.user?.email || 'System'}</span>
                        <span>{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 font-medium text-foreground">{event.message}</div>
                      <div className="text-xs text-muted-foreground">{event.type}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No events yet for this part.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
