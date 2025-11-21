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
  PlusCircle,
  Paperclip,
  Upload,
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
import {
  BUSINESS_OPTIONS,
  getBusinessOptionByCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';

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
const DEFAULT_BUSINESS = (BUSINESS_OPTIONS[0]?.name ?? 'Sterling Tool and Die') as BusinessName;

type Option = { id: string; name: string };

type EditFormState = {
  business: BusinessCode;
  customerId: string;
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

type PartFormState = {
  partNumber: string;
  quantity: string;
  materialId: string;
  notes: string;
};

type AttachmentFormState = {
  label: string;
  url: string;
  mimeType: string;
  storagePath: string;
  uploading: boolean;
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
  const [customers, setCustomers] = useState<Option[]>([]);
  const [machinists, setMachinists] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [partForm, setPartForm] = useState<PartFormState>({
    partNumber: '',
    quantity: '1',
    materialId: '',
    notes: '',
  });
  const [partEdits, setPartEdits] = useState<Record<string, PartFormState>>({});
  const [partEditErrors, setPartEditErrors] = useState<Record<string, string | null>>({});
  const [partSavingIds, setPartSavingIds] = useState<Record<string, boolean>>({});
  const [partSaving, setPartSaving] = useState(false);
  const [partError, setPartError] = useState<string | null>(null);
  const [attachmentForm, setAttachmentForm] = useState<AttachmentFormState>({
    label: '',
    url: '',
    mimeType: '',
    storagePath: '',
    uploading: false,
  });
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentFileKey, setAttachmentFileKey] = useState(0);
  const [attachmentFileName, setAttachmentFileName] = useState<string | null>(null);
  const [attachmentBusiness, setAttachmentBusiness] = useState<BusinessName>(DEFAULT_BUSINESS);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [editForm, setEditForm] = useState<EditFormState>({
    business: BUSINESS_OPTIONS[0]?.code ?? 'STD',
    customerId: '',
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

  const attachmentPathPreview = React.useMemo(() => {
    const selectedBusiness = BUSINESS_OPTIONS.find((option) => option.name === attachmentBusiness);
    const businessSlug = selectedBusiness?.slug ?? (BUSINESS_OPTIONS[0]?.slug ?? 'business');
    const customerName = item?.customer?.name ?? '';
    const customerSlug = slugifyName(customerName, 'customer') || 'customer';
    const referenceValue = item?.orderNumber ?? id;
    const referenceSlug = slugifyName(referenceValue, 'order');
    return `${businessSlug}/${customerSlug || 'customer'}/${referenceSlug}`;
  }, [attachmentBusiness, id, item?.customer?.name, item?.orderNumber]);

  async function load() {
    if (!id) return null;
    setLoading(true);
    let nextItem: any | null = null;
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
      nextItem = data.item;
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
    return nextItem;
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    setExpandedParts({});
  }, [item?.id]);

  useEffect(() => {
    if (!Array.isArray(item?.parts)) {
      setPartEdits({});
      return;
    }
    const next: Record<string, PartFormState> = {};
    item.parts.forEach((part: any) => {
      if (!part?.id) return;
      next[part.id] = {
        partNumber: part.partNumber ?? '',
        quantity: String(part.quantity ?? 1),
        materialId: part.materialId ?? '',
        notes: part.notes ?? '',
      };
    });
    setPartEdits(next);
  }, [item?.parts]);

  useEffect(() => {
    if (item?.attachments?.length) {
      const stored = item.attachments.find((attachment: any) => attachment.storagePath);
      if (stored?.storagePath) {
        const [businessSlug] = stored.storagePath.split('/');
        const match = BUSINESS_OPTIONS.find((option) => option.slug === businessSlug);
        if (match) {
          setAttachmentBusiness(match.name as BusinessName);
          return;
        }
      }
    }
    if (item?.business) {
      const option = getBusinessOptionByCode(item.business);
      if (option) {
        setAttachmentBusiness(option.name as BusinessName);
      }
    }
  }, [item?.attachments, item?.business]);

  useEffect(() => {
    fetch('/api/admin/vendors?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setVendors(list.map((vendor: any) => ({ id: vendor.id, name: vendor.name })));
      })
      .catch(() => setVendors([]));

    fetch('/api/admin/customers?take=200', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setCustomers(list.map((customer: any) => ({ id: customer.id, name: customer.name })));
      })
      .catch(() => setCustomers([]));

    fetch('/api/admin/materials?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setMaterials(list.map((material: any) => ({ id: material.id, name: material.name })));
      })
      .catch(() => setMaterials([]));

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
      business: item.business ?? (BUSINESS_OPTIONS[0]?.code as BusinessCode),
      customerId: item.customerId ?? '',
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

  async function createCustomer() {
    if (!newCustomerName.trim()) return;
    const payload = {
      name: newCustomerName,
      contact: newCustomerContact || undefined,
      phone: newCustomerPhone || undefined,
      email: newCustomerEmail || undefined,
      address: newCustomerAddress || undefined,
    };
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create customer');
      const data = await res.json();
      if (data?.item?.id) {
        setCustomers((prev) => [data.item, ...prev]);
        setEditForm((prev) => ({ ...prev, customerId: data.item.id }));
      }
      setCustomerDialogOpen(false);
      setNewCustomerName('');
      setNewCustomerContact('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
    } catch (error) {
      setEditError((error as Error).message || 'Failed to create customer');
    }
  }

  async function toggleChecklist(addonId: string, checked: boolean) {
    setToggling(addonId);
    try {
      const res = await fetch(`/api/orders/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonId, checked }),
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

  async function handleAddPart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const trimmedPartNumber = partForm.partNumber.trim();
    if (!trimmedPartNumber) {
      setPartError('Part number is required');
      return;
    }
    const quantityValue = Number.parseInt(partForm.quantity, 10);
    if (!Number.isFinite(quantityValue) || quantityValue < 1) {
      setPartError('Quantity must be at least 1');
      return;
    }
    setPartSaving(true);
    setPartError(null);
    try {
      const payload: Record<string, unknown> = {
        partNumber: trimmedPartNumber,
        quantity: quantityValue,
      };
      if (partForm.materialId) payload.materialId = partForm.materialId;
      if (partForm.notes.trim()) payload.notes = partForm.notes.trim();

      const res = await fetch(`/api/orders/${id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const raw = await res.text();
      if (!res.ok) {
        let message = 'Failed to add part';
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            message =
              typeof parsed?.error === 'string'
                ? parsed.error
                : parsed?.message || JSON.stringify(parsed?.error ?? parsed);
          } catch {
            message = raw;
          }
        }
        throw new Error(message || 'Failed to add part');
      }

      let createdPartId: string | undefined;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          createdPartId = parsed?.part?.id as string | undefined;
        } catch {
          createdPartId = undefined;
        }
      }

      setPartForm({ partNumber: '', quantity: '1', materialId: '', notes: '' });
      const updated = await load();
      if (createdPartId) {
        setExpandedParts((prev) => ({ ...prev, [createdPartId]: true }));
      } else if (Array.isArray(updated?.parts) && updated.parts.length) {
        const latest = updated.parts[updated.parts.length - 1];
        if (latest?.id) {
          setExpandedParts((prev) => ({ ...prev, [latest.id]: true }));
        }
      }
    } catch (err: any) {
      setPartError(err.message || 'Failed to add part');
    } finally {
      setPartSaving(false);
    }
  }

  const getPartEditState = (part: any): PartFormState => {
    if (part?.id && partEdits[part.id]) return partEdits[part.id];
    return {
      partNumber: part?.partNumber ?? '',
      quantity: String(part?.quantity ?? 1),
      materialId: part?.materialId ?? '',
      notes: part?.notes ?? '',
    };
  };

  function resetPartEdit(part: any) {
    if (!part?.id) return;
    setPartEdits((prev) => ({
      ...prev,
      [part.id]: {
        partNumber: part.partNumber ?? '',
        quantity: String(part.quantity ?? 1),
        materialId: part.materialId ?? '',
        notes: part.notes ?? '',
      },
    }));
    setPartEditErrors((prev) => ({ ...prev, [part.id]: null }));
  }

  async function handleUpdatePart(part: any) {
    const partId = part?.id;
    if (!id || !partId) return;
    const current = getPartEditState(part);
    const trimmedPartNumber = current.partNumber.trim();
    if (!trimmedPartNumber) {
      setPartEditErrors((prev) => ({ ...prev, [partId]: 'Part number is required' }));
      return;
    }
    const quantityValue = Number.parseInt(current.quantity, 10);
    if (!Number.isFinite(quantityValue) || quantityValue < 1) {
      setPartEditErrors((prev) => ({ ...prev, [partId]: 'Quantity must be at least 1' }));
      return;
    }

    setPartSavingIds((prev) => ({ ...prev, [partId]: true }));
    setPartEditErrors((prev) => ({ ...prev, [partId]: null }));
    try {
      const payload: Record<string, unknown> = {
        partNumber: trimmedPartNumber,
        quantity: quantityValue,
        materialId: current.materialId || null,
        notes: current.notes.trim() ? current.notes.trim() : null,
      };

      const res = await fetch(`/api/orders/${id}/parts/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const raw = await res.text();
      if (!res.ok) {
        let message = 'Failed to update part';
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            message =
              typeof parsed?.error === 'string'
                ? parsed.error
                : parsed?.message || JSON.stringify(parsed?.error ?? parsed);
          } catch {
            message = raw;
          }
        }
        throw new Error(message);
      }

      await load();
    } catch (error: any) {
      setPartEditErrors((prev) => ({ ...prev, [partId]: error?.message || 'Failed to update part' }));
    } finally {
      setPartSavingIds((prev) => ({ ...prev, [partId]: false }));
    }
  }

  async function handleAttachmentFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !item) return;

    const customerName = item.customer?.name?.trim() ?? '';
    if (!customerName) {
      setAttachmentError('Customer information is required before uploading attachments.');
      return;
    }

    const orderReference = (item.orderNumber || '').trim() || id;

    setAttachmentForm((prev) => ({ ...prev, uploading: true }));
    setAttachmentError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('business', attachmentBusiness);
    formData.append('customerName', customerName);
    formData.append('orderReference', orderReference);

    try {
      const res = await fetch('/api/orders/attachments/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        let message = 'Failed to upload attachment';
        try {
          const payload = await res.json();
          if (payload?.error) message = payload.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const result = await res.json().catch(() => ({}));

      setAttachmentForm((prev) => {
        const storagePath = typeof result?.storagePath === 'string' ? result.storagePath : '';
        const url = storagePath ? `/attachments/${storagePath}` : prev.url;
        const label = prev.label || (typeof result?.label === 'string' && result.label) || file.name;
        const mimeType =
          prev.mimeType ||
          (typeof result?.mimeType === 'string' && result.mimeType) ||
          file.type ||
          '';

        return {
          ...prev,
          storagePath,
          url,
          label,
          mimeType,
          uploading: false,
        };
      });
      setAttachmentFileName(file.name);
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to upload attachment';
      setAttachmentError(message);
      setAttachmentForm((prev) => ({ ...prev, uploading: false }));
    }
  }

  async function handleAddAttachment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    if (attachmentForm.uploading) {
      setAttachmentError('Wait for the file upload to finish.');
      return;
    }
    const url = attachmentForm.url.trim();
    const storagePath = attachmentForm.storagePath.trim();
    if (!url && !storagePath) {
      setAttachmentError('Add a link or upload a file to attach.');
      return;
    }
    setAttachmentSaving(true);
    setAttachmentError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (storagePath) {
        payload.storagePath = storagePath;
      } else if (url) {
        payload.url = url;
      }
      if (attachmentForm.label.trim()) payload.label = attachmentForm.label.trim();
      if (attachmentForm.mimeType.trim()) payload.mimeType = attachmentForm.mimeType.trim();

      const res = await fetch(`/api/orders/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const raw = await res.text();
      if (!res.ok) {
        let message = 'Failed to add attachment';
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            message =
              typeof parsed?.error === 'string'
                ? parsed.error
                : parsed?.message || JSON.stringify(parsed?.error ?? parsed);
          } catch {
            message = raw;
          }
        }
        throw new Error(message || 'Failed to add attachment');
      }

      setAttachmentForm({ label: '', url: '', mimeType: '', storagePath: '', uploading: false });
      setAttachmentFileName(null);
      setAttachmentFileKey((prev) => prev + 1);
      await load();
    } catch (err: any) {
      setAttachmentError(err.message || 'Failed to add attachment');
    } finally {
      setAttachmentSaving(false);
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
    if (!editForm.customerId) {
      setEditError('Please select a customer');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        business: editForm.business,
        customerId: editForm.customerId,
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

  const checkedIds = new Set(
    (item.checklist ?? []).filter((c: any) => c.completed).map((c: any) => c.addon?.id)
  );
  const parts: any[] = Array.isArray(item.parts) ? item.parts : [];
  const primaryPart = parts[0];
  const additionalParts = parts.slice(1);
  const attachments: any[] = Array.isArray(item.attachments) ? item.attachments : [];
  const businessOption = BUSINESS_OPTIONS.find((option) => option.code === item.business);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Order {item.orderNumber}</h1>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {businessOption?.prefix ?? item.business}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {businessOption?.name ?? 'Unknown business'}
            </span>
          </div>
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
                    <Label htmlFor="edit-business">Business</Label>
                    <Select
                      value={editForm.business}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, business: value as BusinessCode }))
                      }
                    >
                      <SelectTrigger id="edit-business" className="border-border/60 bg-background/80 text-left">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_OPTIONS.map((option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Customer</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={editForm.customerId || NONE_VALUE}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({ ...prev, customerId: value === NONE_VALUE ? '' : value }))
                        }
                      >
                        <SelectTrigger className="w-full border-border/60 bg-background/80 text-left">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Select customer</SelectItem>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" className="shrink-0">
                            New
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add customer</DialogTitle>
                            <DialogDescription>Create a new customer record for this order.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3">
                            <div className="grid gap-1.5">
                              <Label htmlFor="newCustomerName">Name</Label>
                              <Input
                                id="newCustomerName"
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="Customer name"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="newCustomerContact">Contact</Label>
                              <Input
                                id="newCustomerContact"
                                value={newCustomerContact}
                                onChange={(e) => setNewCustomerContact(e.target.value)}
                                placeholder="Contact name"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="newCustomerPhone">Phone</Label>
                              <Input
                                id="newCustomerPhone"
                                value={newCustomerPhone}
                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                placeholder="555-123-4567"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="newCustomerEmail">Email</Label>
                              <Input
                                id="newCustomerEmail"
                                type="email"
                                value={newCustomerEmail}
                                onChange={(e) => setNewCustomerEmail(e.target.value)}
                                placeholder="name@example.com"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="newCustomerAddress">Address</Label>
                              <Textarea
                                id="newCustomerAddress"
                                value={newCustomerAddress}
                                onChange={(e) => setNewCustomerAddress(e.target.value)}
                                placeholder="Shipping address"
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="ghost" onClick={() => setCustomerDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="button" onClick={createCustomer} disabled={!newCustomerName.trim()}>
                                Add customer
                              </Button>
                            </DialogFooter>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
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
            <CardContent className="grid gap-4 text-sm">
              {primaryPart ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`part-number-${primaryPart.id}`}>Part number</Label>
                      <Input
                        id={`part-number-${primaryPart.id}`}
                        value={getPartEditState(primaryPart).partNumber}
                        onChange={(e) => {
                          setPartEdits((prev) => ({
                            ...prev,
                            [primaryPart.id]: {
                              ...(prev[primaryPart.id] ?? getPartEditState(primaryPart)),
                              partNumber: e.target.value,
                            },
                          }));
                          setPartEditErrors((prev) => ({ ...prev, [primaryPart.id]: null }));
                        }}
                        placeholder="Enter part number"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`part-qty-${primaryPart.id}`}>Quantity</Label>
                      <Input
                        id={`part-qty-${primaryPart.id}`}
                        type="number"
                        min={1}
                        value={getPartEditState(primaryPart).quantity}
                        onChange={(e) => {
                          setPartEdits((prev) => ({
                            ...prev,
                            [primaryPart.id]: {
                              ...(prev[primaryPart.id] ?? getPartEditState(primaryPart)),
                              quantity: e.target.value,
                            },
                          }));
                          setPartEditErrors((prev) => ({ ...prev, [primaryPart.id]: null }));
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`part-material-${primaryPart.id}`}>Material</Label>
                      <Select
                        value={getPartEditState(primaryPart).materialId || NONE_VALUE}
                        onValueChange={(value) => {
                          setPartEdits((prev) => ({
                            ...prev,
                            [primaryPart.id]: {
                              ...(prev[primaryPart.id] ?? getPartEditState(primaryPart)),
                              materialId: value === NONE_VALUE ? '' : value,
                            },
                          }));
                          setPartEditErrors((prev) => ({ ...prev, [primaryPart.id]: null }));
                        }}
                      >
                        <SelectTrigger
                          id={`part-material-${primaryPart.id}`}
                          className="border-border/60 bg-background/80 text-left"
                        >
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>TBD</SelectItem>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor={`part-notes-${primaryPart.id}`}>Notes</Label>
                      <Textarea
                        id={`part-notes-${primaryPart.id}`}
                        value={getPartEditState(primaryPart).notes}
                        onChange={(e) => {
                          setPartEdits((prev) => ({
                            ...prev,
                            [primaryPart.id]: {
                              ...(prev[primaryPart.id] ?? getPartEditState(primaryPart)),
                              notes: e.target.value,
                            },
                          }));
                          setPartEditErrors((prev) => ({ ...prev, [primaryPart.id]: null }));
                        }}
                        placeholder="Surface finish, tolerances, tooling, etc."
                        className="min-h-[90px]"
                      />
                    </div>
                  </div>
                  {partEditErrors[primaryPart.id] && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {partEditErrors[primaryPart.id]}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="space-y-1">
                      <div>Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'TBD'}</div>
                      <div>
                        Machinist {item.assignedMachinist?.name ?? item.assignedMachinist?.email ?? 'Unassigned'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetPartEdit(primaryPart)}
                        disabled={partSavingIds[primaryPart.id]}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleUpdatePart(primaryPart)}
                        disabled={partSavingIds[primaryPart.id]}
                        className="rounded-full"
                      >
                        {partSavingIds[primaryPart.id] ? 'Saving…' : 'Save part'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No part details yet.</p>
              )}
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
                          className="grid gap-4 border-t border-border/60 bg-background/70 px-3 py-3 text-sm"
                        >
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                              <Label htmlFor={`part-number-${part.id}`}>Part number</Label>
                              <Input
                                id={`part-number-${part.id}`}
                                value={getPartEditState(part).partNumber}
                                onChange={(e) => {
                                  setPartEdits((prev) => ({
                                    ...prev,
                                    [part.id]: {
                                      ...(prev[part.id] ?? getPartEditState(part)),
                                      partNumber: e.target.value,
                                    },
                                  }));
                                  setPartEditErrors((prev) => ({ ...prev, [part.id]: null }));
                                }}
                                placeholder="Enter part number"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`part-qty-${part.id}`}>Quantity</Label>
                              <Input
                                id={`part-qty-${part.id}`}
                                type="number"
                                min={1}
                                value={getPartEditState(part).quantity}
                                onChange={(e) => {
                                  setPartEdits((prev) => ({
                                    ...prev,
                                    [part.id]: {
                                      ...(prev[part.id] ?? getPartEditState(part)),
                                      quantity: e.target.value,
                                    },
                                  }));
                                  setPartEditErrors((prev) => ({ ...prev, [part.id]: null }));
                                }}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`part-material-${part.id}`}>Material</Label>
                              <Select
                                value={getPartEditState(part).materialId || NONE_VALUE}
                                onValueChange={(value) => {
                                  setPartEdits((prev) => ({
                                    ...prev,
                                    [part.id]: {
                                      ...(prev[part.id] ?? getPartEditState(part)),
                                      materialId: value === NONE_VALUE ? '' : value,
                                    },
                                  }));
                                  setPartEditErrors((prev) => ({ ...prev, [part.id]: null }));
                                }}
                              >
                                <SelectTrigger
                                  id={`part-material-${part.id}`}
                                  className="border-border/60 bg-background/80 text-left"
                                >
                                  <SelectValue placeholder="Select material" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE_VALUE}>TBD</SelectItem>
                                  {materials.map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      {material.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-1.5 sm:col-span-2">
                              <Label htmlFor={`part-notes-${part.id}`}>Notes</Label>
                              <Textarea
                                id={`part-notes-${part.id}`}
                                value={getPartEditState(part).notes}
                                onChange={(e) => {
                                  setPartEdits((prev) => ({
                                    ...prev,
                                    [part.id]: {
                                      ...(prev[part.id] ?? getPartEditState(part)),
                                      notes: e.target.value,
                                    },
                                  }));
                                  setPartEditErrors((prev) => ({ ...prev, [part.id]: null }));
                                }}
                                placeholder="Surface finish, tolerances, tooling, etc."
                                className="min-h-[90px]"
                              />
                            </div>
                          </div>
                          {partEditErrors[part.id] && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                              {partEditErrors[part.id]}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                            <div className="space-y-1">
                              <div>Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'TBD'}</div>
                              <div>
                                Machinist {item.assignedMachinist?.name ?? item.assignedMachinist?.email ?? 'Unassigned'}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => resetPartEdit(part)}
                                disabled={partSavingIds[part.id]}
                              >
                                Reset
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdatePart(part)}
                                disabled={partSavingIds[part.id]}
                                className="rounded-full"
                              >
                                {partSavingIds[part.id] ? 'Saving…' : 'Save part'}
                              </Button>
                            </div>
                          </div>
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
                <PlusCircle className="h-4 w-4 text-muted-foreground" /> Add another part
              </CardTitle>
              <CardDescription>Extend this order with additional line items.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddPart}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="new-part-number">Part number</Label>
                    <Input
                      id="new-part-number"
                      value={partForm.partNumber}
                      onChange={(e) => {
                        setPartForm((prev) => ({ ...prev, partNumber: e.target.value }));
                        setPartError(null);
                      }}
                      placeholder="e.g. SP-1024"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-part-quantity">Quantity</Label>
                    <Input
                      id="new-part-quantity"
                      type="number"
                      min={1}
                      value={partForm.quantity}
                      onChange={(e) => {
                        setPartForm((prev) => ({ ...prev, quantity: e.target.value }));
                        setPartError(null);
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-part-material">Material</Label>
                    <Select
                      value={partForm.materialId || NONE_VALUE}
                      onValueChange={(value) => {
                        setPartForm((prev) => ({ ...prev, materialId: value === NONE_VALUE ? '' : value }));
                      }}
                    >
                      <SelectTrigger id="new-part-material" className="border-border/60 bg-background/80 text-left">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>TBD</SelectItem>
                        {materials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="new-part-notes">Notes</Label>
                    <Textarea
                      id="new-part-notes"
                      value={partForm.notes}
                      onChange={(e) => {
                        setPartForm((prev) => ({ ...prev, notes: e.target.value }));
                        setPartError(null);
                      }}
                      placeholder="Surface finish, tolerances, tooling, etc."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
                {partError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {partError}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={partSaving} className="rounded-full">
                    {partSaving ? 'Adding…' : 'Add part'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

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
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={checkedIds.has(c.addon?.id)}
                      disabled={!!toggling || !c.addon?.id}
                      onCheckedChange={(value) => {
                        if (!c.addon?.id) return;
                        toggleChecklist(c.addon.id, value === true);
                      }}
                    />
                    <div>
                      <div className="font-medium text-foreground">
                        {c.addon?.name ?? 'Add-on removed'}
                      </div>
                      {c.addon?.description && (
                        <div className="text-xs text-muted-foreground">{c.addon.description}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(c.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const rate = ((c.addon?.rateCents ?? 0) / 100).toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      });
                      return c.addon?.rateType === 'HOURLY' ? `${rate} / hr` : rate;
                    })()}
                  </span>
                </label>
              ))}
              {(!item.checklist || item.checklist.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No services assigned. Manage add-ons from the admin dashboard.
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
                <Paperclip className="h-4 w-4 text-muted-foreground" /> Attachments
              </CardTitle>
              <CardDescription>Link drawings or upload reference files shared with the team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {attachments.length ? (
                  attachments.map((att: any, index: number) => {
                    const key = att.id ?? `attachment-${index + 1}`;
                    const uploadedLabel = att.uploadedBy?.name || att.uploadedBy?.email || '';
                    const openHref = att.storagePath ? `/attachments/${att.storagePath}` : att.url;
                    const hasLink = typeof openHref === 'string' && openHref.length > 0;
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-medium text-foreground">{att.label || 'Attachment'}</div>
                            <div className="text-xs text-muted-foreground">
                              {att.mimeType || 'Unknown type'}
                              {att.storagePath ? (
                                <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                  Stored
                                </span>
                              ) : null}
                            </div>
                            {att.storagePath ? (
                              <div className="text-xs text-muted-foreground">
                                Path:{' '}
                                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{att.storagePath}</code>
                              </div>
                            ) : null}
                          </div>
                          {hasLink ? (
                            <a
                              href={openHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">No link</span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Uploaded {att.createdAt ? new Date(att.createdAt).toLocaleString() : 'recently'}
                          {uploadedLabel ? ` by ${uploadedLabel}` : ''}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No attachments yet. Add links or upload files below.</p>
                )}
              </div>
              <form className="space-y-3" onSubmit={handleAddAttachment}>
                <div className="grid gap-2 sm:max-w-md">
                  <Label>Storage business</Label>
                  <Select value={attachmentBusiness} onValueChange={(value) => setAttachmentBusiness(value as BusinessName)}>
                    <SelectTrigger className="border-border/60 bg-background/80">
                      <SelectValue placeholder="Select a business" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_OPTIONS.map((option) => (
                        <SelectItem key={option.slug} value={option.name}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Files upload to{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{attachmentPathPreview}</code>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="attachment-label">Label</Label>
                    <Input
                      id="attachment-label"
                      value={attachmentForm.label}
                      onChange={(e) => {
                        setAttachmentForm((prev) => ({ ...prev, label: e.target.value }));
                        setAttachmentError(null);
                      }}
                      placeholder="e.g. REV B STEP"
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
                      placeholder="application/step"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="attachment-url">External link</Label>
                    <Input
                      id="attachment-url"
                      value={attachmentForm.url}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAttachmentForm((prev) => ({
                          ...prev,
                          url: value,
                          storagePath: value.trim().length ? '' : prev.storagePath,
                        }));
                        setAttachmentError(null);
                      }}
                      placeholder="Paste a shared link or upload a file to populate this field"
                      disabled={attachmentForm.uploading}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="attachment-file">Upload file</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        key={attachmentFileKey}
                        id="attachment-file"
                        type="file"
                        className="bg-background/80"
                        onChange={(e) => void handleAttachmentFile(e.target.files)}
                        disabled={attachmentForm.uploading}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        {attachmentForm.uploading ? 'Uploading…' : 'Drop a file to upload'}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Uploads are written to the shared storage above for easy access.</p>
                      {attachmentForm.storagePath ? (
                        <p className="flex flex-wrap items-center gap-1">
                          Stored file:
                          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{attachmentForm.storagePath}</code>
                          <a
                            href={`/attachments/${attachmentForm.storagePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            Open stored copy
                          </a>
                        </p>
                      ) : (
                        <p>{attachmentForm.uploading ? 'Uploading…' : 'Add a file to copy it into shared storage.'}</p>
                      )}
                      {attachmentFileName ? <p>Selected: {attachmentFileName}</p> : null}
                    </div>
                  </div>
                </div>
                {attachmentError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {attachmentError}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={attachmentSaving || attachmentForm.uploading}
                    className="rounded-full"
                  >
                    {attachmentSaving ? 'Attaching…' : 'Add attachment'}
                  </Button>
                </div>
              </form>
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
