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
  StickyNote,
  ChevronDown,
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
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS: Array<[string, string]> = [
  ['NEW', 'New'],
  ['PROGRAMMING', 'Programming'],
  ['RUNNING', 'Running'],
  ['INSPECTING', 'Inspecting'],
  ['READY_FOR_ADDONS', 'Ready for addons'],
  ['COMPLETE', 'Complete'],
  ['CLOSED', 'Closed'],
];

const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'RUSH', 'HOT'];
const NONE_VALUE = '__none__';

type Option = { id: string; name: string };

type EditFormState = {
  receivedDate: string;
  dueDate: string;
  priority: string;
  vendorId: string;
  poNumber: string;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
  assignedMachinistId: string;
};

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
  const [vendors, setVendors] = useState<Option[]>([]);
  const [machinists, setMachinists] = useState<Option[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    receivedDate: '',
    dueDate: '',
    priority: 'NORMAL',
    vendorId: '',
    poNumber: '',
    materialNeeded: false,
    materialOrdered: false,
    modelIncluded: false,
    assignedMachinistId: '',
  });
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

  useEffect(() => {
    fetch('/api/admin/vendors?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setVendors(list.map((vendor: any) => ({ id: vendor.id, name: vendor.name })));
      })
      .catch(() => setVendors([]));

    fetch('/api/admin/users?role=MACHINIST&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setMachinists(
          raw.map((m: any) => ({
            id: m.id,
            name: m.name || m.email || 'Unnamed machinist',
          }))
        );
      })
      .catch(() => setMachinists([]));
  }, []);

  useEffect(() => {
    if (!item) return;
    const received = item.receivedDate ? new Date(item.receivedDate) : null;
    const due = item.dueDate ? new Date(item.dueDate) : null;
    setEditForm({
      receivedDate: received && !Number.isNaN(received.getTime()) ? received.toISOString().slice(0, 10) : '',
      dueDate: due && !Number.isNaN(due.getTime()) ? due.toISOString().slice(0, 10) : '',
      priority: item.priority ?? 'NORMAL',
      vendorId: item.vendorId ?? '',
      poNumber: item.poNumber ?? '',
      materialNeeded: !!item.materialNeeded,
      materialOrdered: !!item.materialOrdered,
      modelIncluded: !!item.modelIncluded,
      assignedMachinistId: item.assignedMachinistId ?? '',
    });
  }, [item]);

  useEffect(() => {
    if (!editOpen) {
      setEditError(null);
    }
  }, [editOpen]);

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

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        receivedDate: editForm.receivedDate,
        dueDate: editForm.dueDate,
        priority: editForm.priority,
        vendorId: editForm.vendorId,
        poNumber: editForm.poNumber,
        materialNeeded: editForm.materialNeeded,
        materialOrdered: editForm.materialOrdered,
        modelIncluded: editForm.modelIncluded,
        assignedMachinistId: editForm.assignedMachinistId,
      };
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to update order');
      }
      setEditOpen(false);
      await load();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update order');
    } finally {
      setEditSaving(false);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Order {item.orderNumber}</h1>
          <p className="text-muted-foreground">
            Customer-facing details, shop routing, and production notes for this work order.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              >
                Edit order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit order details</DialogTitle>
                <DialogDescription>Update scheduling, assignments, and material status.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleEditSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-received">Received date</Label>
                    <Input
                      id="edit-received"
                      type="date"
                      value={editForm.receivedDate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, receivedDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-due">Due date</Label>
                    <Input
                      id="edit-due"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value) => setEditForm((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger id="edit-priority" className="border-border/60 bg-background/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-machinist">Machinist</Label>
                    <Select
                      value={editForm.assignedMachinistId || NONE_VALUE}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          assignedMachinistId: value === NONE_VALUE ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger id="edit-machinist" className="border-border/60 bg-background/80 text-left">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                        {machinists.map((machinist) => (
                          <SelectItem key={machinist.id} value={machinist.id}>
                            {machinist.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-vendor">Vendor</Label>
                    <Select
                      value={editForm.vendorId || NONE_VALUE}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, vendorId: value === NONE_VALUE ? '' : value }))
                      }
                    >
                      <SelectTrigger id="edit-vendor" className="border-border/60 bg-background/80 text-left">
                        <SelectValue placeholder="No vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>No vendor</SelectItem>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-po">PO number</Label>
                    <Input
                      id="edit-po"
                      value={editForm.poNumber}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, poNumber: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Material &amp; model
                  </Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        id="edit-material-needed"
                        checked={editForm.materialNeeded}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => ({
                            ...prev,
                            materialNeeded: checked === true,
                            materialOrdered: checked === true ? prev.materialOrdered : false,
                          }))
                        }
                      />
                      <span>Material needed</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        id="edit-material-ordered"
                        checked={editForm.materialOrdered}
                        disabled={!editForm.materialNeeded}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => ({
                            ...prev,
                            materialOrdered: checked === true,
                          }))
                        }
                      />
                      <span>Material ordered / on hand</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        id="edit-model"
                        checked={editForm.modelIncluded}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => ({ ...prev, modelIncluded: checked === true }))
                        }
                      />
                      <span>Model provided by customer</span>
                    </label>
                  </div>
                </div>
                {editError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {editError}
                  </div>
                )}
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSaving} className="rounded-full">
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Machinist</span>
                <span className="text-muted-foreground">
                  {item.assignedMachinist?.name ?? item.assignedMachinist?.email ?? 'Unassigned'}
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
  );
}
