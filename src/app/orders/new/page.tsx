"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle, Upload, Printer } from 'lucide-react';
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
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const priorities = ['LOW', 'NORMAL', 'RUSH', 'HOT'];
const OPTIONAL_VALUE = '__none__';

type Option = { id: string; name: string };
type ChecklistOption = { id: string; label: string };
type PartInput = { partNumber: string; quantity: number; materialId?: string; notes?: string };
type AttachmentInput = { url: string; label: string; mimeType?: string };

const emptyPart = (): PartInput => ({ partNumber: '', quantity: 1, materialId: '', notes: '' });
const emptyAttachment = (): AttachmentInput => ({ url: '', label: '', mimeType: '' });

export default function NewOrderPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = React.useState('');
  const [customers, setCustomers] = React.useState<Option[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState('');
  const [newCustomerContact, setNewCustomerContact] = React.useState('');
  const [newCustomerPhone, setNewCustomerPhone] = React.useState('');
  const [newCustomerEmail, setNewCustomerEmail] = React.useState('');
  const [newCustomerAddress, setNewCustomerAddress] = React.useState('');
  const [vendors, setVendors] = React.useState<Option[]>([]);
  const [materials, setMaterials] = React.useState<Option[]>([]);
  const [machinists, setMachinists] = React.useState<Option[]>([]);
  const [checklistItems, setChecklistItems] = React.useState<ChecklistOption[]>([]);
  const [vendorId, setVendorId] = React.useState('');
  const [poNumber, setPoNumber] = React.useState('');
  const [assignedMachinistId, setAssignedMachinistId] = React.useState('');
  const [selectedChecklist, setSelectedChecklist] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState('NORMAL');
  const [parts, setParts] = React.useState<PartInput[]>([emptyPart()]);
  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([emptyAttachment()]);
  const [materialNeeded, setMaterialNeeded] = React.useState(false);
  const [materialOrdered, setMaterialOrdered] = React.useState(false);
  const [modelIncluded, setModelIncluded] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(null);
  const router = useRouter();
  const handlePrintNewOrder = React.useCallback(() => {
    if (!createdOrderId) return;
    window.open(`/orders/${createdOrderId}/print`, '_blank', 'noopener,noreferrer');
  }, [createdOrderId]);
  React.useEffect(() => {
    fetch('/api/admin/customers?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setCustomers(data.items ?? data ?? []))
      .catch(() => setCustomers([]));

    fetch('/api/admin/vendors?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setVendors(data.items ?? []))
      .catch(() => setVendors([]));

    fetch('/api/admin/materials?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setMaterials(data.items ?? []))
      .catch(() => setMaterials([]));

    fetch('/api/admin/users?role=MACHINIST&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const raw = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setMachinists(
          raw.map((m: any) => ({
            id: m.id,
            name: m.name || m.email || 'Unnamed machinist',
          }))
        );
      })
      .catch(() => setMachinists([]));

    fetch('/api/admin/checklist-items?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setChecklistItems(data.items ?? []))
      .catch(() => setChecklistItems([]));

    const standard = [
      'Deburr',
      'Heat Treat',
      'Grind',
      'Stamp',
      'Inspect',
      'Paint',
      'Black Oxide',
      'Plating',
      'Powder Coating',
      'Zinc',
    ];

    (async () => {
      try {
        const res = await fetch('/api/admin/checklist-items?take=500', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const existing = (data.items ?? []) as ChecklistOption[];
        const existingLabels = new Set(existing.map((i) => i.label.toLowerCase()));
        for (const label of standard) {
          if (!existingLabels.has(label.toLowerCase())) {
            await fetch('/api/admin/checklist-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label }),
              credentials: 'include',
            });
          }
        }
        const refreshed = await fetch('/api/admin/checklist-items?take=500', {
          credentials: 'include',
        });
        if (refreshed.ok) {
          const d2 = await refreshed.json();
          setChecklistItems(d2.items ?? []);
        }
      } catch (e) {
        // ignore background seeding errors
      }
    })();
  }, []);

  function updatePart(index: number, patch: Partial<PartInput>) {
    setParts((prev) => prev.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  function addPartRow() {
    setParts((prev) => [...prev, emptyPart()]);
  }

  function removePart(index: number) {
    setParts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function updateAttachment(index: number, patch: Partial<AttachmentInput>) {
    setAttachments((prev) => prev.map((att, i) => (i === index ? { ...att, ...patch } : att)));
  }

  function addAttachmentRow() {
    setAttachments((prev) => [...prev, emptyAttachment()]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function handleAttachmentFile(index: number, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      updateAttachment(index, {
        url: result,
        label: attachments[index]?.label || file.name,
        mimeType: file.type || attachments[index]?.mimeType,
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setCreatedOrderId(null);

    const cleanedParts = parts
      .map((part) => ({
        partNumber: part.partNumber.trim(),
        quantity: Number.isFinite(part.quantity) ? part.quantity : 1,
        materialId: part.materialId ? part.materialId : undefined,
        notes: part.notes?.trim() ? part.notes.trim() : undefined,
      }))
      .filter((part) => part.partNumber.length > 0);

    if (!customerId) {
      setMessage('Please choose a customer.');
      setLoading(false);
      return;
    }

    if (!dueDate) {
      setMessage('Please provide a due date.');
      setLoading(false);
      return;
    }

    if (cleanedParts.length === 0) {
      setMessage('Add at least one part with a part number.');
      setLoading(false);
      return;
    }

    const cleanAttachments = attachments
      .map((att) => ({
        url: att.url.trim(),
        label: att.label?.trim() || undefined,
        mimeType: att.mimeType?.trim() || undefined,
      }))
      .filter((att) => att.url.length > 0);

    const body = {
      customerId,
      modelIncluded,
      receivedDate: new Date().toISOString().slice(0, 10),
      dueDate,
      priority,
      materialNeeded,
      materialOrdered,
      vendorId: vendorId || undefined,
      poNumber: poNumber || undefined,
      assignedMachinistId: assignedMachinistId || undefined,
      parts: cleanedParts,
      checklistItemIds: selectedChecklist,
      attachments: cleanAttachments,
      notes: notes.trim() ? notes.trim() : undefined,
    } as any;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const newId = typeof data?.id === 'string' ? data.id : null;
      setMessage('Order created! Choose what to do next.');
      setCreatedOrderId(newId);
      if (!newId) {
        router.push('/orders');
      }
      setCustomerId('');
      setVendorId('');
      setPoNumber('');
      setDueDate('');
      setPriority('NORMAL');
      setAssignedMachinistId('');
      setParts([emptyPart()]);
      setAttachments([emptyAttachment()]);
      setSelectedChecklist([]);
      setMaterialNeeded(false);
      setMaterialOrdered(false);
      setModelIncluded(false);
      setNotes('');
    } else {
      let errorMessage = 'Error creating order';
      try {
        const error = await res.json();
        errorMessage = error?.error ? JSON.stringify(error.error) : errorMessage;
      } catch {
        // ignore JSON parsing failures
      }
      setMessage(errorMessage);
      setCreatedOrderId(null);
    }
    setLoading(false);
  }

  async function createCustomer() {
    if (!newCustomerName.trim()) return;
    const payload = {
      name: newCustomerName,
      contact: newCustomerContact || undefined,
      phone: newCustomerPhone || undefined,
      email: newCustomerEmail || undefined,
      address: newCustomerAddress || undefined,
    };
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      setCustomers((s) => [data.item, ...s]);
      setCustomerId(data.item.id);
      setCustomerDialogOpen(false);
      setNewCustomerName('');
      setNewCustomerContact('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Intake</p>
        <h1 className="text-4xl font-semibold text-foreground">Create a production order</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Order numbers are generated for you, starting at 1001. Gather every part, attachment, and checklist item before the job hits the floor.
        </p>
      </div>

      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Customer & schedule</CardTitle>
            <CardDescription>Who is the work for and when do they need it?</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="customer" className="border-border/60 bg-background/80">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="justify-start px-0 text-sm text-primary">
                    + Add customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New customer</DialogTitle>
                    <DialogDescription>Quickly capture a new customer record.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="newCustomerName">Name</Label>
                      <Input
                        id="newCustomerName"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Customer name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newCustomerContact">Contact</Label>
                      <Input
                        id="newCustomerContact"
                        value={newCustomerContact}
                        onChange={(e) => setNewCustomerContact(e.target.value)}
                        placeholder="Contact name (optional)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newCustomerPhone">Phone</Label>
                      <Input
                        id="newCustomerPhone"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newCustomerEmail">Email</Label>
                      <Input
                        id="newCustomerEmail"
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="contact@example.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newCustomerAddress">Address</Label>
                      <Textarea
                        id="newCustomerAddress"
                        value={newCustomerAddress}
                        onChange={(e) => setNewCustomerAddress(e.target.value)}
                        placeholder="Shipping address"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setCustomerDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={createCustomer}>
                      Save customer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" className="border-border/60 bg-background/80">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="machinist">Assign machinist</Label>
              <Select
                value={assignedMachinistId || OPTIONAL_VALUE}
                onValueChange={(value) =>
                  setAssignedMachinistId(value === OPTIONAL_VALUE ? '' : value)
                }
              >
                <SelectTrigger id="machinist" className="border-border/60 bg-background/80">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_VALUE}>Unassigned</SelectItem>
                  {machinists.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="poNumber">PO number</Label>
              <Input
                id="poNumber"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Optional purchase order"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Vendors & materials</CardTitle>
            <CardDescription>Capture sourcing and prep requirements.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select
                value={vendorId || OPTIONAL_VALUE}
                onValueChange={(value) => setVendorId(value === OPTIONAL_VALUE ? '' : value)}
              >
                <SelectTrigger id="vendor" className="border-border/60 bg-background/80">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_VALUE}>No vendor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <Checkbox checked={materialNeeded} onCheckedChange={(v) => setMaterialNeeded(v === true)} />
                Material needed from purchasing
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <Checkbox
                  checked={materialOrdered}
                  onCheckedChange={(v) => setMaterialOrdered(v === true)}
                  disabled={!materialNeeded}
                />
                Material ordered / on hand
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <Checkbox checked={modelIncluded} onCheckedChange={(v) => setModelIncluded(v === true)} />
                CAD model provided with job
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Parts in this order</CardTitle>
              <CardDescription>Track every unique part, quantity, and preferred material.</CardDescription>
            </div>
            <Button type="button" variant="secondary" className="rounded-full border border-primary/40 bg-primary/10 text-primary" onClick={addPartRow}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add part
            </Button>
          </CardHeader>
          <CardContent className="grid gap-6">
            {parts.map((part, index) => (
              <div key={index} className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Part {index + 1}
                  </h3>
                  {parts.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePart(index)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Part number</Label>
                    <Input
                      value={part.partNumber}
                      onChange={(e) => updatePart(index, { partNumber: e.target.value })}
                      placeholder="e.g. SP-1024"
                      required={index === 0}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={part.quantity}
                      onChange={(e) => updatePart(index, { quantity: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Preferred material</Label>
                    <Select
                      value={part.materialId || OPTIONAL_VALUE}
                      onValueChange={(value) => updatePart(index, { materialId: value === OPTIONAL_VALUE ? '' : value })}
                    >
                      <SelectTrigger className="border-border/60 bg-background/80">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={OPTIONAL_VALUE}>TBD</SelectItem>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={part.notes}
                      onChange={(e) => updatePart(index, { notes: e.target.value })}
                      placeholder="Surface finish, tolerances, tooling, etc."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Link drawings, STEP files, or upload lightweight references.</CardDescription>
            </div>
            <Button type="button" variant="secondary" className="rounded-full border border-primary/40 bg-primary/10 text-primary" onClick={addAttachmentRow}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add attachment
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {attachments.map((att, index) => (
              <div key={index} className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Attachment {index + 1}
                  </h3>
                  {attachments.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Label</Label>
                    <Input
                      value={att.label}
                      onChange={(e) => updateAttachment(index, { label: e.target.value })}
                      placeholder="e.g. REV B STEP"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Link or data URL</Label>
                    <Input
                      value={att.url}
                      onChange={(e) => updateAttachment(index, { url: e.target.value })}
                      placeholder="Paste Google Drive or SharePoint link"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Mime type</Label>
                    <Input
                      value={att.mimeType}
                      onChange={(e) => updateAttachment(index, { mimeType: e.target.value })}
                      placeholder="application/step"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Upload file</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        className="bg-background/80"
                        onChange={(e) => handleAttachmentFile(index, e.target.files)}
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploading will embed a base64 data URL if you don&apos;t have a hosted link handy.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Checklist & notes</CardTitle>
            <CardDescription>Toggle the finishing steps and include launch notes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label>Checklist items</Label>
              <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-4 sm:grid-cols-2">
                {checklistItems.map((item) => {
                  const checked = selectedChecklist.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const isChecked = value === true;
                          setSelectedChecklist((sel) =>
                            isChecked ? [...sel, item.id] : sel.filter((id) => id !== item.id)
                          );
                        }}
                      />
                      <span className="leading-snug text-foreground">{item.label}</span>
                    </label>
                  );
                })}
                {checklistItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No checklist templates yet. Add items from the admin dashboard.
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Launch notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, fixtures, or inspection notes"
                className="min-h-[140px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Orders auto-number starting at 1001
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={loading} className="rounded-full bg-primary px-6 text-primary-foreground shadow-lg shadow-primary/30">
                {loading ? 'Submitting…' : 'Create order'}
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/orders">Cancel</Link>
              </Button>
            </div>
          </CardFooter>
          {(message || createdOrderId) && (
            <div className="px-6 pb-6">
              {message && <p className="text-sm text-primary">{message}</p>}
              {createdOrderId && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => router.push(`/orders/${createdOrderId}`)}
                    className="rounded-full px-6"
                  >
                    View order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrintNewOrder}
                    className="rounded-full border-border/60 bg-background/80"
                  >
                    <Printer className="mr-2 h-4 w-4" /> Print order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/orders')}
                    className="rounded-full border-border/60 bg-background/80"
                  >
                    Back to orders
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}

