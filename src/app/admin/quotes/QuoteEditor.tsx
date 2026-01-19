'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { fetchJson } from '@/lib/fetchJson';
import {
  BUSINESS_OPTIONS,
  getBusinessOptionByCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';

import type { QuoteCreateInput } from '@/lib/zod-quotes';

const NO_MATERIAL_VALUE = '__no_material__';

type Option = {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type AddonOption = {
  id: string;
  name: string;
  rateType: 'HOURLY' | 'FLAT';
  rateCents: number;
  active: boolean;
  description?: string | null;
};

type QuotePartState = {
  key: string;
  name: string;
  partNumber: string;
  materialId: string;
  stockSize: string;
  cutLength: string;
  description: string;
  quantity: string;
  pieceCount: string;
  notes: string;
  addonSelections: QuoteAddonState[];
};

type QuoteVendorItemState = {
  key: string;
  vendorId: string;
  vendorName: string;
  partNumber: string;
  partUrl: string;
  basePrice: string;
  markupPercent: string;
  notes: string;
};

type QuoteAddonState = {
  key: string;
  addonId: string;
  units: string;
  notes: string;
};


type AttachmentState = {
  key: string;
  url: string;
  storagePath: string;
  label: string;
  mimeType: string;
  uploading?: boolean;
};

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  business: BusinessCode;
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  customerId?: string | null;
  status: string;
  materialSummary?: string | null;
  purchaseItems?: string | null;
  requirements?: string | null;
  notes?: string | null;
  basePriceCents: number;
  vendorTotalCents: number;
  addonsTotalCents: number;
  totalCents: number;
  multiPiece: boolean;
  parts: Array<{
    id: string;
    name: string;
    partNumber?: string | null;
    materialId?: string | null;
    material?: { id: string; name: string; spec?: string | null } | null;
    stockSize?: string | null;
    cutLength?: string | null;
    description?: string | null;
    quantity: number;
    pieceCount: number;
    notes?: string | null;
    addonSelections?: Array<{
      id: string;
      quotePartId?: string | null;
      addonId: string;
      units: number;
      rateTypeSnapshot: string;
      rateCents: number;
      totalCents: number;
      notes?: string | null;
      addon?: { id: string; name: string; rateType: string; rateCents: number } | null;
    }>;
  }>;
  vendorItems: Array<{
    id: string;
    vendorId?: string | null;
    vendorName?: string | null;
    partNumber?: string | null;
    partUrl?: string | null;
    basePriceCents: number;
    markupPercent: number;
    finalPriceCents: number;
    notes?: string | null;
  }>;
  addonSelections?: Array<{
    id: string;
    quotePartId?: string | null;
    addonId: string;
    units: number;
    rateTypeSnapshot: string;
    rateCents: number;
    totalCents: number;
    notes?: string | null;
    addon?: { id: string; name: string; rateType: string; rateCents: number } | null;
  }>;
  attachments: Array<{
    id: string;
    url?: string | null;
    storagePath?: string | null;
    label?: string | null;
    mimeType?: string | null;
  }>;
};

interface QuoteEditorProps {
  mode: 'create' | 'edit';
  initialQuote?: QuoteDetail;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXPIRED', label: 'Expired' },
];

const MARKUP_SUGGESTIONS = [10, 15, 20];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const centsFromString = (value: string) => {
  const parsed = Number.parseFloat(value || '0');
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
};

const numberFromString = (value: string) => {
  const parsed = Number.parseFloat(value || '0');
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

const createKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function QuoteEditor({ mode, initialQuote }: QuoteEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  const initialBusinessCode = (initialQuote?.business ?? BUSINESS_OPTIONS[0]?.code ?? 'STD') as BusinessCode;

  const [form, setForm] = useState({
    business: initialBusinessCode,
    quoteNumber: initialQuote?.quoteNumber ?? '',
    companyName: initialQuote?.companyName ?? '',
    contactName: initialQuote?.contactName ?? '',
    contactEmail: initialQuote?.contactEmail ?? '',
    contactPhone: initialQuote?.contactPhone ?? '',
    customerId: initialQuote?.customerId ?? '',
    status: initialQuote?.status ?? 'DRAFT',
    materialSummary: initialQuote?.materialSummary ?? '',
    purchaseItems: initialQuote?.purchaseItems ?? '',
    requirements: initialQuote?.requirements ?? '',
    notes: initialQuote?.notes ?? '',
    basePrice: ((initialQuote?.basePriceCents ?? 0) / 100).toFixed(2),
    multiPiece: initialQuote?.multiPiece ?? false,
  });

  const buildEmptyPart = React.useCallback(
    () =>
      ({
        key: createKey(),
        name: '',
        partNumber: '',
        materialId: '',
        stockSize: '',
        cutLength: '',
        description: '',
        quantity: '1',
        pieceCount: '1',
        notes: '',
        addonSelections: [],
      }) satisfies QuotePartState,
    []
  );

  const [parts, setParts] = useState<QuotePartState[]>(
    (initialQuote?.parts ?? []).length
      ? (() => {
          const legacySelections = (initialQuote?.addonSelections ?? []).filter(
            (selection) => !selection.quotePartId
          );
          return (initialQuote?.parts ?? []).map((part, index) => {
            const selections = part.addonSelections?.length
              ? part.addonSelections
              : index === 0
                ? legacySelections
                : [];
            return {
              key: part.id,
              name: part.name,
              partNumber: part.partNumber ?? '',
              materialId: part.materialId ?? '',
              stockSize: part.stockSize ?? '',
              cutLength: part.cutLength ?? '',
              description: part.description ?? '',
              quantity: String(part.quantity ?? 1),
              pieceCount: String(part.pieceCount ?? 1),
              notes: part.notes ?? '',
              addonSelections: selections.map((selection) => ({
                key: selection.id,
                addonId: selection.addonId,
                units: String(selection.units ?? 0),
                notes: selection.notes ?? '',
              })),
            };
          });
        })()
      : [buildEmptyPart()]
  );

  const [vendorItems, setVendorItems] = useState<QuoteVendorItemState[]>(
    (initialQuote?.vendorItems ?? []).map((item) => ({
      key: item.id,
      vendorId: item.vendorId ?? '',
      vendorName: item.vendorName ?? '',
      partNumber: item.partNumber ?? '',
      partUrl: item.partUrl ?? '',
      basePrice: ((item.basePriceCents ?? 0) / 100).toFixed(2),
      markupPercent: String(item.markupPercent ?? 0),
      notes: item.notes ?? '',
    }))
  );

  const initialAttachmentBusiness = useMemo<BusinessName>(() => {
    const stored = initialQuote?.attachments?.find((attachment) => attachment.storagePath);
    if (stored?.storagePath) {
      const [businessSlug] = stored.storagePath.split('/');
      const match = BUSINESS_OPTIONS.find((option) => option.slug === businessSlug);
      if (match) {
        return match.name;
      }
    }
    if (initialQuote?.business) {
      const match = getBusinessOptionByCode(initialQuote.business);
      if (match) {
        return match.name;
      }
    }
    return (BUSINESS_OPTIONS[0]?.name as BusinessName) ?? ('Sterling Tool and Die' as BusinessName);
  }, [initialQuote]);

  const [attachmentBusiness, setAttachmentBusiness] = useState<BusinessName>(initialAttachmentBusiness);

  const [attachments, setAttachments] = useState<AttachmentState[]>(
    (initialQuote?.attachments ?? []).map((attachment) => ({
      key: attachment.id,
      url: attachment.url ?? (attachment.storagePath ? `/attachments/${attachment.storagePath}` : ''),
      storagePath: attachment.storagePath ?? '',
      label: attachment.label ?? '',
      mimeType: attachment.mimeType ?? '',
      uploading: false,
    }))
  );

  useEffect(() => {
    setAttachmentBusiness(initialAttachmentBusiness);
  }, [initialAttachmentBusiness]);

  useEffect(() => {
    const shouldSync = mode === 'create' || !(initialQuote?.attachments?.length ?? 0);
    if (!shouldSync) return;
    const option = getBusinessOptionByCode(form.business);
    if (option) {
      setAttachmentBusiness(option.name as BusinessName);
    }
  }, [form.business, initialQuote?.attachments?.length, mode]);

  const [draftReference] = useState(() => createKey());

  const selectedBusinessOption = useMemo(() => {
    return BUSINESS_OPTIONS.find((option) => option.name === attachmentBusiness) ?? BUSINESS_OPTIONS[0];
  }, [attachmentBusiness]);

  const attachmentPathPreview = useMemo(() => {
    const businessSlug = selectedBusinessOption?.slug ?? 'business';
    const customerSlug = slugifyName(form.companyName, 'customer') || 'customer';
    const referenceValue = (form.quoteNumber || '').trim() || (initialQuote?.quoteNumber || '').trim() || draftReference;
    const referenceSlug = slugifyName(referenceValue, 'quote');
    return `${businessSlug}/${customerSlug}/${referenceSlug}`;
  }, [draftReference, form.companyName, form.quoteNumber, initialQuote?.quoteNumber, selectedBusinessOption]);

  useEffect(() => {
    fetch('/api/admin/addons?active=true&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : data;
        setAddons(
          (list ?? []).map((item: any) => ({
            id: item.id,
            name: item.name,
            rateType: item.rateType,
            rateCents: item.rateCents,
            active: item.active,
            description: item.description,
          }))
        );
      })
      .catch(() => setAddons([]));

    fetch('/api/admin/vendors?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : data;
        setVendors((list ?? []).map((item: any) => ({ id: item.id, name: item.name })));
      })
      .catch(() => setVendors([]));

    fetch('/api/admin/materials?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setMaterials(data.items ?? []))
      .catch(() => setMaterials([]));

    fetch('/api/admin/customers?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const list = Array.isArray(data?.items) ? data.items : data;
        setCustomers(
          (list ?? []).map((item: any) => ({
            id: item.id,
            name: item.name,
            contact: item.contact ?? item.contactName ?? null,
            phone: item.phone ?? null,
            email: item.email ?? null,
            address: item.address ?? null,
          })),
        );
      })
      .catch(() => setCustomers([]));
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    const selected = customers.find((customer) => customer.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      companyName: selected?.name ?? prev.companyName,
      contactName: selected?.contact ?? prev.contactName,
      contactEmail: selected?.email ?? prev.contactEmail,
      contactPhone: selected?.phone ?? prev.contactPhone,
    }));
  };

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
      const newCustomer: Option = {
        id: data.item.id,
        name: data.item.name,
        contact: data.item.contact ?? data.item.contactName ?? null,
        phone: data.item.phone ?? null,
        email: data.item.email ?? null,
        address: data.item.address ?? null,
      };
      setCustomers((s) => [newCustomer, ...s]);
      handleCustomerSelect(newCustomer.id);
      setCustomerDialogOpen(false);
      setNewCustomerName('');
      setNewCustomerContact('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
    }
  }

  function addPart() {
    setParts((prev) => [...prev, buildEmptyPart()]);
  }

  function addVendorItem() {
    setVendorItems((prev) => [
      ...prev,
      {
        key: createKey(),
        vendorId: '',
        vendorName: '',
        partNumber: '',
        partUrl: '',
        basePrice: '0.00',
        markupPercent: '20',
        notes: '',
      },
    ]);
  }

  function addAddonSelection(partKey: string) {
    setParts((prev) =>
      prev.map((part) =>
        part.key === partKey
          ? { ...part, addonSelections: [...part.addonSelections, { key: createKey(), addonId: '', units: '1.0', notes: '' }] }
          : part
      )
    );
  }

  function addAttachment() {
    setAttachments((prev) => [
      ...prev,
      { key: createKey(), url: '', storagePath: '', label: '', mimeType: '', uploading: false },
    ]);
  }

  function updateAddonSelection(partKey: string, selectionKey: string, patch: Partial<QuoteAddonState>) {
    setParts((prev) =>
      prev.map((part) =>
        part.key === partKey
          ? {
              ...part,
              addonSelections: part.addonSelections.map((selection) =>
                selection.key === selectionKey ? { ...selection, ...patch } : selection
              ),
            }
          : part
      )
    );
  }

  function removeAddonSelection(partKey: string, selectionKey: string) {
    setParts((prev) =>
      prev.map((part) =>
        part.key === partKey
          ? { ...part, addonSelections: part.addonSelections.filter((selection) => selection.key !== selectionKey) }
          : part
      )
    );
  }

  async function handleAttachmentUpload(attachmentKey: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const customerName = form.companyName.trim();
    if (!customerName) {
      toast.push('Enter the company name before uploading attachments.', 'error');
      return;
    }

    const referenceValue =
      (form.quoteNumber || '').trim() || (initialQuote?.quoteNumber || '').trim() || draftReference;

    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.key === attachmentKey ? { ...attachment, uploading: true } : attachment
      )
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('business', attachmentBusiness);
    formData.append('customerName', customerName);
    formData.append('quoteNumber', referenceValue);

    try {
      const response = await fetch('/api/admin/quotes/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'Failed to upload attachment';
        try {
          const body = await response.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      const result = await response.json();

      setAttachments((prev) =>
        prev.map((attachment) => {
          if (attachment.key !== attachmentKey) return attachment;

          const storagePath = typeof result?.storagePath === 'string' ? result.storagePath : '';
          const updatedUrl = storagePath ? `/attachments/${storagePath}` : attachment.url;
          const mimeType =
            (typeof result?.mimeType === 'string' && result.mimeType) ||
            attachment.mimeType ||
            file.type ||
            '';
          const label =
            attachment.label ||
            (typeof result?.label === 'string' && result.label) ||
            file.name;

          return {
            ...attachment,
            storagePath,
            url: updatedUrl,
            mimeType,
            label,
            uploading: false,
          };
        })
      );

      toast.push('Attachment uploaded', 'success');
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to upload attachment';
      toast.push(message, 'error');
    } finally {
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.key === attachmentKey ? { ...attachment, uploading: false } : attachment
        )
      );
    }
  }

  const addonMap = useMemo(() => new Map(addons.map((addon) => [addon.id, addon])), [addons]);

  const vendorTotalsCents = vendorItems.reduce((sum, item) => {
    const base = centsFromString(item.basePrice);
    const markup = Number.parseFloat(item.markupPercent || '0');
    const final = Math.round(base * (1 + (Number.isNaN(markup) ? 0 : markup / 100)));
    return sum + (final > 0 ? final : 0);
  }, 0);

  const addonsTotalsCents = parts.reduce((sum, part) => {
    return (
      sum +
      part.addonSelections.reduce((innerSum, selection) => {
        const addon = addonMap.get(selection.addonId);
        if (!addon) return innerSum;
        const units = numberFromString(selection.units);
        return innerSum + Math.round(addon.rateCents * (units > 0 ? units : 0));
      }, 0)
    );
  }, 0);

  const basePriceCents = centsFromString(form.basePrice);
  const totalCents = basePriceCents + vendorTotalsCents + addonsTotalsCents;

  const buildPayload = (): QuoteCreateInput => ({
    business: form.business,
    quoteNumber: form.quoteNumber || undefined,
    companyName: form.companyName,
    contactName: form.contactName || undefined,
    contactEmail: form.contactEmail || undefined,
    contactPhone: form.contactPhone || undefined,
    customerId: form.customerId || undefined,
    status: form.status || 'DRAFT',
    materialSummary: form.materialSummary || undefined,
    purchaseItems: form.purchaseItems || undefined,
    requirements: form.requirements || undefined,
    notes: form.notes || undefined,
    basePriceCents,
    multiPiece: form.multiPiece,
    parts: parts
      .filter((part) => part.name.trim())
      .map((part) => ({
        name: part.name,
        partNumber: part.partNumber || undefined,
        materialId: part.materialId || undefined,
        stockSize: part.stockSize || undefined,
        cutLength: part.cutLength || undefined,
        description: part.description || undefined,
        quantity: Number.parseInt(part.quantity || '1', 10) || 1,
        pieceCount: Number.parseInt(part.pieceCount || '1', 10) || 1,
        notes: part.notes || undefined,
        addonSelections: part.addonSelections
          .filter((selection) => selection.addonId)
          .map((selection) => ({
            addonId: selection.addonId,
            units: numberFromString(selection.units),
            notes: selection.notes || undefined,
          })),
      })),
    vendorItems: vendorItems
      .filter((item) => item.vendorId || item.vendorName || centsFromString(item.basePrice) > 0)
      .map((item) => ({
        vendorId: item.vendorId || undefined,
        vendorName: item.vendorName || undefined,
        partNumber: item.partNumber || undefined,
        partUrl: item.partUrl || undefined,
        basePriceCents: centsFromString(item.basePrice),
        markupPercent: Number.parseFloat(item.markupPercent || '0') || 0,
        finalPriceCents: 0,
        notes: item.notes || undefined,
      })),
    attachments: attachments
      .filter((attachment) => attachment.url.trim().length > 0 || attachment.storagePath.trim().length > 0)
      .map((attachment) => ({
        url: attachment.url.trim() ? attachment.url.trim() : undefined,
        storagePath: attachment.storagePath.trim() ? attachment.storagePath.trim() : undefined,
        label: attachment.label || undefined,
        mimeType: attachment.mimeType || undefined,
      })),
  });

  const submitQuote = async () => {
    setLoading(true);
    setError(null);
    const payload = buildPayload();
    try {
      const response =
        mode === 'edit' && initialQuote
          ? await fetchJson<{ item: QuoteDetail }>(`/api/admin/quotes/${initialQuote.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          : await fetchJson<{ item: QuoteDetail }>(`/api/admin/quotes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

      toast.push(mode === 'edit' ? 'Quote updated' : 'Quote created', 'success');
      router.push(`/admin/quotes/${response.item.id}`);
    } catch (err: any) {
      setError(err?.body?.error || err.message || 'Failed to save quote');
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuote();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General information</CardTitle>
          <CardDescription>Who is requesting the work and how we can reach them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="quoteBusiness">Business *</Label>
            <select
              id="quoteBusiness"
              value={form.business}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, business: event.target.value as BusinessCode }))
              }
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {BUSINESS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.prefix} — {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteCompanyName">Company *</Label>
            <Select value={form.customerId} onValueChange={handleCustomerSelect}>
              <SelectTrigger id="quoteCompanySelect" className="border border-border bg-background px-3 py-2 text-sm">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
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
            <Input
              id="quoteCompanyName"
              value={form.companyName}
              onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
              placeholder="Company name"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteNumber">Quote #</Label>
            <Input
              id="quoteNumber"
              value={form.quoteNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, quoteNumber: event.target.value }))}
              placeholder="Auto-generated if blank"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteContact">Contact / Engineer</Label>
            <Input
              id="quoteContact"
              value={form.contactName}
              onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteEmail">Contact email</Label>
            <Input
              id="quoteEmail"
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quotePhone">Contact phone</Label>
            <Input
              id="quotePhone"
              value={form.contactPhone}
              onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteStatus">Status</Label>
            <select
              id="quoteStatus"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteBasePrice">Base fabrication price (USD)</Label>
            <Input
              id="quoteBasePrice"
              type="number"
              step="0.01"
              min="0"
              value={form.basePrice}
              onChange={(event) => setForm((prev) => ({ ...prev, basePrice: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="quoteMultiPiece"
              checked={form.multiPiece}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, multiPiece: Boolean(checked) }))}
            />
            <Label htmlFor="quoteMultiPiece" className="text-sm font-normal">
              Multi-piece assemblies included
            </Label>
          </div>
        </CardContent>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="quoteMaterials">Materials / stock summary</Label>
            <Textarea
              id="quoteMaterials"
              value={form.materialSummary}
              onChange={(event) => setForm((prev) => ({ ...prev, materialSummary: event.target.value }))}
              placeholder="Material specs, thickness, and finish requirements"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quotePurchaseItems">Purchased items (hardware, kits, etc.)</Label>
            <Textarea
              id="quotePurchaseItems"
              value={form.purchaseItems}
              onChange={(event) => setForm((prev) => ({ ...prev, purchaseItems: event.target.value }))}
              placeholder="List of hardware or kits that need to be procured"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteRequirements">Requirements / process notes</Label>
            <Textarea
              id="quoteRequirements"
              value={form.requirements}
              onChange={(event) => setForm((prev) => ({ ...prev, requirements: event.target.value }))}
              placeholder="Welding, finishing, or inspection instructions"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteNotes">Internal notes</Label>
            <Textarea
              id="quoteNotes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Internal notes for the estimating team"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parts</CardTitle>
          <CardDescription>Break down the parts or assemblies included in this quote.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {parts.map((part, index) => (
            <div key={part.key} className="rounded border border-border/50 bg-card/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Part name *</Label>
                    <Input
                      value={part.name}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, name: event.target.value } : item))
                        )
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Part number</Label>
                    <Input
                      value={part.partNumber}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) =>
                            item.key === part.key ? { ...item, partNumber: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Optional part #"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={part.quantity}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, quantity: event.target.value } : item))
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Piece count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={part.pieceCount}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, pieceCount: event.target.value } : item))
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Material</Label>
                    <Select
                      value={part.materialId || NO_MATERIAL_VALUE}
                      onValueChange={(value) =>
                        setParts((prev) =>
                          prev.map((item) =>
                            item.key === part.key
                              ? { ...item, materialId: value === NO_MATERIAL_VALUE ? '' : value }
                              : item
                          )
                        )
                      }
                    >
                      <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm text-left">
                        <SelectValue placeholder="Select material (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MATERIAL_VALUE}>No material (optional)</SelectItem>
                        {materials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Stock size</Label>
                    <Input
                      value={part.stockSize}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, stockSize: event.target.value } : item))
                        )
                      }
                      placeholder='e.g. "2in x 12in bar"'
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Cut length</Label>
                    <Input
                      value={part.cutLength}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, cutLength: event.target.value } : item))
                        )
                      }
                      placeholder='e.g. "6.5 in"'
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={part.notes}
                      onChange={(event) =>
                        setParts((prev) =>
                          prev.map((item) => (item.key === part.key ? { ...item, notes: event.target.value } : item))
                        )
                      }
                      placeholder="Optional internal notes"
                    />
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setParts((prev) => prev.filter((item) => item.key !== part.key))}
                    disabled={parts.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                <Label>Description</Label>
                <Textarea
                  value={part.description}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((item) => (item.key === part.key ? { ...item, description: event.target.value } : item))
                    )
                  }
                  placeholder="What needs to happen for this part or assembly?"
                />
              </div>
              <div className="mt-4 space-y-3 rounded border border-border/60 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Add-ons & labor</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addAddonSelection(part.key)}>
                    Add add-on
                  </Button>
                </div>
                {part.addonSelections.length === 0 && (
                  <p className="text-xs text-muted-foreground">No add-ons assigned to this part yet.</p>
                )}
                {part.addonSelections.map((selection) => {
                  const addon = addonMap.get(selection.addonId);
                  const units = numberFromString(selection.units);
                  const totalCents = addon ? Math.round(addon.rateCents * (units > 0 ? units : 0)) : 0;
                  return (
                    <div key={selection.key} className="rounded border border-border/50 bg-card/40 p-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label className="text-xs">Add-on</Label>
                          <select
                            value={selection.addonId}
                            onChange={(event) =>
                              updateAddonSelection(part.key, selection.key, { addonId: event.target.value })
                            }
                            className="rounded border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Select add-on</option>
                            {addons.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} ({option.rateType === 'HOURLY' ? 'Hourly' : 'Flat'})
                              </option>
                            ))}
                          </select>
                          {addon?.description && (
                            <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">{addon?.rateType === 'FLAT' ? 'Quantity' : 'Hours'}</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.25"
                            value={selection.units}
                            onChange={(event) => updateAddonSelection(part.key, selection.key, { units: event.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="rounded border border-border/60 bg-background px-3 py-2 text-sm">
                            {addon
                              ? `${formatCurrency(addon.rateCents)} x ${units.toFixed(2)} = ${formatCurrency(totalCents)}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 mt-3">
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          value={selection.notes}
                          onChange={(event) => updateAddonSelection(part.key, selection.key, { notes: event.target.value })}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeAddonSelection(part.key, selection.key)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {addons.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Need more options? Configure add-ons in the{' '}
                    <Link href="/admin/addons" className="underline">
                      Add-ons admin panel
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addPart}>
            Add part
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchased items</CardTitle>
          <CardDescription>
            Track vendor-sourced hardware or kits. Suggest markup percentages below to keep estimates consistent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vendorItems.map((item) => {
            const markupValue = Number.parseFloat(item.markupPercent || '0') || 0;
            const finalCents = Math.round(centsFromString(item.basePrice) * (1 + markupValue / 100));
            return (
              <div key={item.key} className="rounded border border-border/50 bg-card/40 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Vendor</Label>
                    <select
                      value={item.vendorId}
                      onChange={(event) =>
                        {
                          const selected = vendors.find((option) => option.id === event.target.value);
                          setVendorItems((prev) =>
                            prev.map((row) =>
                              row.key === item.key
                                ? { ...row, vendorId: event.target.value, vendorName: selected?.name ?? '' }
                                : row
                            )
                          );
                        }
                      }
                      className="rounded border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Override vendor name</Label>
                    <Input
                      value={item.vendorName}
                      onChange={(event) =>
                        setVendorItems((prev) =>
                          prev.map((row) =>
                            row.key === item.key ? { ...row, vendorName: event.target.value } : row
                          )
                        )
                      }
                      placeholder={vendors.find((option) => option.id === item.vendorId)?.name}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Part number</Label>
                    <Input
                      value={item.partNumber}
                      onChange={(event) =>
                        setVendorItems((prev) =>
                          prev.map((row) => (row.key === item.key ? { ...row, partNumber: event.target.value } : row))
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Link</Label>
                    <Input
                      value={item.partUrl}
                      onChange={(event) =>
                        setVendorItems((prev) =>
                          prev.map((row) => (row.key === item.key ? { ...row, partUrl: event.target.value } : row))
                        )
                      }
                      placeholder="https://"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Base cost (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.basePrice}
                      onChange={(event) =>
                        setVendorItems((prev) =>
                          prev.map((row) => (row.key === item.key ? { ...row, basePrice: event.target.value } : row))
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Markup %</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        value={item.markupPercent}
                        onChange={(event) =>
                          setVendorItems((prev) =>
                            prev.map((row) => (row.key === item.key ? { ...row, markupPercent: event.target.value } : row))
                          )
                        }
                        className="w-24"
                      />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        Suggestions:
                        {MARKUP_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="rounded border border-border/60 bg-background px-2 py-1 text-xs"
                            onClick={() =>
                              setVendorItems((prev) =>
                                prev.map((row) =>
                                  row.key === item.key
                                    ? { ...row, markupPercent: suggestion.toString() }
                                    : row
                                )
                              )
                            }
                          >
                            {suggestion}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Estimated total: <span className="font-medium text-primary">{formatCurrency(finalCents)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setVendorItems((prev) => prev.filter((row) => row.key !== item.key))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label>Notes</Label>
                  <Textarea
                    value={item.notes}
                    onChange={(event) =>
                      setVendorItems((prev) =>
                        prev.map((row) => (row.key === item.key ? { ...row, notes: event.target.value } : row))
                      )
                    }
                    placeholder="Why is this item required?"
                  />
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addVendorItem}>
            Add purchased item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>Link drawings, spreadsheets, or other supporting documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:w-1/2">
            <Label htmlFor="quoteAttachmentBusiness">Business folder</Label>
            <select
              id="quoteAttachmentBusiness"
              value={attachmentBusiness}
              onChange={(event) => setAttachmentBusiness(event.target.value as BusinessName)}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {BUSINESS_OPTIONS.map((option) => (
                <option key={option.slug} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Files upload under <code className="font-mono text-xs">{attachmentPathPreview}</code> inside the storage root.
            </p>
          </div>
          {attachments.map((attachment) => {
            const storedUrl = attachment.storagePath ? `/attachments/${attachment.storagePath}` : '';
            return (
              <div
                key={attachment.key}
                className="grid gap-4 rounded border border-border/50 bg-card/40 p-4 md:grid-cols-2"
              >
                <div className="grid gap-2">
                  <Label>Label</Label>
                  <Input
                    value={attachment.label}
                    onChange={(event) =>
                      setAttachments((prev) =>
                        prev.map((row) =>
                          row.key === attachment.key ? { ...row, label: event.target.value } : row
                        )
                      )
                    }
                    placeholder="Customer print"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>MIME type</Label>
                  <Input
                    value={attachment.mimeType}
                    onChange={(event) =>
                      setAttachments((prev) =>
                        prev.map((row) =>
                          row.key === attachment.key ? { ...row, mimeType: event.target.value } : row
                        )
                      )
                    }
                    placeholder="application/pdf"
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Link URL</Label>
                  <Input
                    value={attachment.url}
                    onChange={(event) =>
                      setAttachments((prev) =>
                        prev.map((row) =>
                          row.key === attachment.key ? { ...row, url: event.target.value } : row
                        )
                      )
                    }
                    placeholder="https://"
                  />
                  {attachment.storagePath ? (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Stored file ready to open.</span>
                      <Link
                        href={storedUrl}
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open stored file
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Provide an external link or upload a file below.
                    </p>
                  )}
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Upload file</Label>
                  <input
                    type="file"
                    onChange={async (event) => {
                      await handleAttachmentUpload(attachment.key, event.target.files);
                      event.target.value = '';
                    }}
                    disabled={attachment.uploading}
                    className="block w-full text-sm text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    {attachment.uploading ? 'Uploading…' : 'Uploads replace the link above with a secure download URL.'}
                  </p>
                </div>
                <div className="flex items-end justify-end md:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAttachments((prev) => prev.filter((row) => row.key !== attachment.key))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addAttachment}>
            Add attachment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Totals update automatically as you edit the quote.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between text-sm">
            <span>Base fabrication</span>
            <span className="font-medium">{formatCurrency(basePriceCents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Vendor purchases</span>
            <span className="font-medium">{formatCurrency(vendorTotalsCents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Add-ons and labor</span>
            <span className="font-medium">{formatCurrency(addonsTotalsCents)}</span>
          </div>
          <div className="border-t border-border/60 pt-3 text-sm font-semibold">
            <div className="flex items-center justify-between">
              <span>Total estimate</span>
              <span className="text-lg text-primary">{formatCurrency(totalCents)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Add-on rates remain private—only admins can view hourly costs.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create quote'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
