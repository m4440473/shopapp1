"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  BUSINESS_OPTIONS,
  getBusinessOptionByCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';
import { CustomFieldInputs, type CustomFieldDefinition } from '@/components/CustomFieldInputs';
import { hasCustomFieldValue } from '@/lib/custom-field-values';

const priorities = ['LOW', 'NORMAL', 'RUSH', 'HOT'];
const OPTIONAL_VALUE = '__none__';

const createKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const DEFAULT_BUSINESS_OPTION = BUSINESS_OPTIONS[0];
const DEFAULT_BUSINESS_NAME = (DEFAULT_BUSINESS_OPTION?.name ?? 'Sterling Tool and Die') as BusinessName;
const DEFAULT_BUSINESS_CODE = (DEFAULT_BUSINESS_OPTION?.code ?? 'STD') as BusinessCode;

type Option = { id: string; name: string };
type AddonOption = {
  id: string;
  name: string;
  description?: string | null;
  rateType?: 'HOURLY' | 'FLAT';
  active?: boolean;
};
type PartInput = {
  partNumber: string;
  quantity: number;
  materialId?: string;
  stockSize?: string;
  cutLength?: string;
  notes?: string;
};
type AttachmentInput = { url: string; storagePath: string; label: string; mimeType: string; uploading?: boolean };

const emptyPart = (): PartInput => ({
  partNumber: '',
  quantity: 1,
  materialId: '',
  stockSize: '',
  cutLength: '',
  notes: '',
});
const emptyAttachment = (): AttachmentInput => ({ url: '', storagePath: '', label: '', mimeType: '', uploading: false });

const buildPartNotes = (part: {
  description: string | null;
  notes: string | null;
  pieceCount: number;
  stockSize?: string | null;
  cutLength?: string | null;
}) => {
  const lines: string[] = [];
  if (part.description) lines.push(part.description.trim());
  if (part.pieceCount > 1) lines.push(`Pieces: ${part.pieceCount}`);
  if (part.stockSize) lines.push(`Stock size: ${part.stockSize}`);
  if (part.cutLength) lines.push(`Cut length: ${part.cutLength}`);
  if (part.notes) lines.push(part.notes.trim());
  const combined = lines.join('\n').trim();
  return combined.length ? combined : '';
};

const buildConversionNote = (quote: any) => {
  const now = new Date();
  const sections: string[] = [`Converted from quote ${quote.quoteNumber} on ${now.toLocaleString()}.`];
  if (quote.materialSummary) sections.push(`Materials:\n${quote.materialSummary}`);
  if (quote.purchaseItems) sections.push(`Purchase items:\n${quote.purchaseItems}`);
  if (quote.requirements) sections.push(`Requirements:\n${quote.requirements}`);
  if (quote.notes) sections.push(`Quote notes:\n${quote.notes}`);
  const content = sections.join('\n\n').trim();
  return content.length ? content : '';
};

const defaultDueDate = () => {
  const base = new Date();
  base.setDate(base.getDate() + 14);
  return base.toISOString().slice(0, 10);
};

function NewOrderForm() {
  const searchParams = useSearchParams();
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
  const [addons, setAddons] = React.useState<AddonOption[]>([]);
  const [vendorId, setVendorId] = React.useState('');
  const [poNumber, setPoNumber] = React.useState('');
  const [assignedMachinistId, setAssignedMachinistId] = React.useState('');
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState('NORMAL');
  const [business, setBusiness] = React.useState<BusinessCode>(DEFAULT_BUSINESS_CODE);
  const [parts, setParts] = React.useState<PartInput[]>([emptyPart()]);
  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([emptyAttachment()]);
  const [attachmentBusiness, setAttachmentBusiness] = React.useState<BusinessName>(DEFAULT_BUSINESS_NAME);
  const [draftAttachmentReference] = React.useState(() => createKey());
  const [materialNeeded, setMaterialNeeded] = React.useState(false);
  const [materialOrdered, setMaterialOrdered] = React.useState(false);
  const [modelIncluded, setModelIncluded] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [customFields, setCustomFields] = React.useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(null);
  const [quotePrefillError, setQuotePrefillError] = React.useState<string | null>(null);
  const [quotePrefillLoading, setQuotePrefillLoading] = React.useState(false);
  const quoteId = searchParams.get('quoteId');
  const conversionMode = Boolean(quoteId);
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

    fetch('/api/orders/addons?active=true&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setAddons((data.items ?? []).filter((item: AddonOption) => item.active !== false)))
      .catch(() => setAddons([]));
  }, []);

  React.useEffect(() => {
    const option = getBusinessOptionByCode(business);
    if (option) {
      setAttachmentBusiness(option.name as BusinessName);
    }
  }, [business]);

  React.useEffect(() => {
    setCustomFieldValues({});
    fetch(`/api/custom-fields?entityType=ORDER&businessCode=${business}&isActive=true`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const nextFields = data.items ?? [];
        setCustomFields(nextFields);
        setCustomFieldValues((prev) => {
          const next = { ...prev };
          nextFields.forEach((field: CustomFieldDefinition) => {
            if (next[field.id] === undefined && field.defaultValue !== undefined) {
              next[field.id] = field.defaultValue;
            }
          });
          return next;
        });
      })
      .catch(() => setCustomFields([]));
  }, [business]);

  React.useEffect(() => {
    if (!quoteId) return;
    setQuotePrefillLoading(true);
    setQuotePrefillError(null);
    fetch(`/api/admin/quotes/${quoteId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const quote = data?.item;
        if (!quote) throw new Error('Quote not found');
        setBusiness(quote.business);
        setCustomerId(quote.customer?.id ?? '');
        setModelIncluded(Boolean(quote.multiPiece));
        setParts(
          (quote.parts ?? []).length
            ? quote.parts.map((part: any) => ({
                partNumber: part.partNumber ?? part.name ?? '',
                quantity: part.quantity ?? 1,
                materialId: part.materialId ?? '',
                stockSize: part.stockSize ?? '',
                cutLength: part.cutLength ?? '',
                notes: buildPartNotes({
                  description: part.description ?? null,
                  notes: part.notes ?? null,
                  pieceCount: part.pieceCount ?? 1,
                  stockSize: part.stockSize ?? null,
                  cutLength: part.cutLength ?? null,
                }),
              }))
            : [emptyPart()],
        );
        const quoteAddonIds = new Set<string>();
        (quote.parts ?? []).forEach((part: any) => {
          (part.addonSelections ?? []).forEach((sel: any) => {
            const addonId = sel.addon?.id ?? sel.addonId ?? null;
            if (addonId) quoteAddonIds.add(addonId);
          });
        });
        (quote.addonSelections ?? []).forEach((sel: any) => {
          const addonId = sel.addon?.id ?? sel.addonId ?? null;
          if (addonId) quoteAddonIds.add(addonId);
        });
        setSelectedAddonIds(Array.from(quoteAddonIds));
        setDueDate((quote.dueDate as string | null)?.slice(0, 10) || defaultDueDate());
        setNotes((prev) => prev || buildConversionNote(quote));
      })
      .catch(() => {
        setQuotePrefillError('Unable to prefill from quote. You can still create the order manually.');
      })
      .finally(() => setQuotePrefillLoading(false));
  }, [quoteId]);

  const selectedBusinessOption = React.useMemo(
    () => BUSINESS_OPTIONS.find((option) => option.name === attachmentBusiness) ?? BUSINESS_OPTIONS[0],
    [attachmentBusiness],
  );

  const attachmentPathPreview = React.useMemo(() => {
    const businessSlug = selectedBusinessOption?.slug ?? 'business';
    const customerName = customers.find((c) => c.id === customerId)?.name ?? '';
    const customerSlug = slugifyName(customerName, 'customer') || 'customer';
    const referenceValue = (poNumber || '').trim() || draftAttachmentReference;
    const referenceSlug = slugifyName(referenceValue, 'order');
    return `${businessSlug}/${customerSlug || 'customer'}/${referenceSlug}`;
  }, [customerId, customers, draftAttachmentReference, poNumber, selectedBusinessOption]);

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

  function handleAttachmentUrlChange(index: number, value: string) {
    setAttachments((prev) =>
      prev.map((att, i) =>
        i === index
          ? {
              ...att,
              url: value,
              storagePath: value.trim().length ? '' : att.storagePath,
            }
          : att,
      ),
    );
  }

  function addAttachmentRow() {
    setAttachments((prev) => [...prev, emptyAttachment()]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleAttachmentFile(index: number, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const customerName = customers.find((customer) => customer.id === customerId)?.name?.trim() ?? '';
    if (!customerName) {
      setMessage('Select a customer before uploading attachments.');
      return;
    }

    const orderReference = (poNumber || '').trim() || draftAttachmentReference;

    setAttachments((prev) =>
      prev.map((att, i) => (i === index ? { ...att, uploading: true } : att)),
    );
    setMessage('');

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
        let errorMessage = 'Failed to upload attachment';
        try {
          const payload = await res.json();
          if (payload?.error) errorMessage = payload.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }

      const result = await res.json().catch(() => ({}));

      setAttachments((prev) =>
        prev.map((att, i) => {
          if (i !== index) return att;
          const storagePath = typeof result?.storagePath === 'string' ? result.storagePath : '';
          const url = storagePath ? `/attachments/${storagePath}` : att.url;
          const label = att.label || (typeof result?.label === 'string' && result.label) || file.name;
          const mimeType =
            att.mimeType ||
            (typeof result?.mimeType === 'string' && result.mimeType) ||
            file.type ||
            '';

          return {
            ...att,
            storagePath,
            url,
            label,
            mimeType,
            uploading: false,
          };
        }),
      );
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Failed to upload attachment';
      setMessage(message);
      setAttachments((prev) =>
        prev.map((att, i) => (i === index ? { ...att, uploading: false } : att)),
      );
    }
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
        stockSize: part.stockSize?.trim() ? part.stockSize.trim() : undefined,
        cutLength: part.cutLength?.trim() ? part.cutLength.trim() : undefined,
        notes: part.notes?.trim() ? part.notes.trim() : undefined,
      }))
      .filter((part) => part.partNumber.length > 0);

    if (!customerId) {
      setMessage('Please choose a customer.');
      setLoading(false);
      return;
    }

    if (cleanedParts.length === 0) {
      setMessage('Add at least one part with a part number.');
      setLoading(false);
      return;
    }

    if (attachments.some((att) => att.uploading)) {
      setMessage('Please wait for attachment uploads to finish.');
      setLoading(false);
      return;
    }

    const missingFields = customFields.filter(
      (field) => field.isRequired && !hasCustomFieldValue(customFieldValues[field.id])
    );
    if (missingFields.length) {
      setMessage(`Fill in required custom fields: ${missingFields.map((field) => field.name).join(', ')}.`);
      setLoading(false);
      return;
    }

    const resolvedDueDate = dueDate || defaultDueDate();

    const cleanAttachments = attachments
      .map((att) => {
        const storagePath = att.storagePath.trim();
        const url = att.url.trim();
        const label = att.label.trim();
        const mimeType = att.mimeType.trim();
        return {
          url: storagePath ? undefined : url || undefined,
          storagePath: storagePath || undefined,
          label: label || undefined,
          mimeType: mimeType || undefined,
        };
      })
      .filter((att) => Boolean(att.url?.length || att.storagePath?.length));

    const body = {
      customerId,
      modelIncluded,
      receivedDate: new Date().toISOString().slice(0, 10),
      dueDate: resolvedDueDate,
      priority,
      business,
      materialNeeded,
      materialOrdered,
      vendorId: vendorId || undefined,
      poNumber: poNumber || undefined,
      assignedMachinistId: assignedMachinistId || undefined,
      parts: cleanedParts,
      addonIds: selectedAddonIds,
      attachments: cleanAttachments,
      notes: notes.trim() ? notes.trim() : undefined,
      customFieldValues: customFields
        .map((field) => ({ fieldId: field.id, value: customFieldValues[field.id] }))
        .filter((entry) => hasCustomFieldValue(entry.value)),
    } as any;

    if (conversionMode && quoteId) {
      const res = await fetch(`/api/admin/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dueDate: resolvedDueDate,
          priority,
          vendorId: vendorId || undefined,
          poNumber: poNumber || undefined,
          assignedMachinistId: assignedMachinistId || undefined,
          materialNeeded,
          materialOrdered,
          modelIncluded,
          parts: cleanedParts,
          notes: notes.trim() || undefined,
          customFieldValues: customFields
            .map((field) => ({ fieldId: field.id, value: customFieldValues[field.id] }))
            .filter((entry) => hasCustomFieldValue(entry.value)),
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const newId = typeof data?.orderId === 'string' ? data.orderId : null;
        setMessage('Order created from quote!');
        setCreatedOrderId(newId);
        if (newId) {
          router.push(`/orders/${newId}`);
        }
      } else {
        let errorMessage = 'Conversion failed';
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
      return;
    }

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
      setBusiness(DEFAULT_BUSINESS_CODE);
      setAssignedMachinistId('');
      setParts([emptyPart()]);
      setAttachments([emptyAttachment()]);
      setAttachmentBusiness(DEFAULT_BUSINESS_NAME);
      setSelectedAddonIds([]);
      setMaterialNeeded(false);
      setMaterialOrdered(false);
      setModelIncluded(false);
      setNotes('');
      setCustomFieldValues({});
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
        <h1 className="text-4xl font-semibold text-foreground">
          {conversionMode ? 'Convert quote to order' : 'Create a production order'}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {conversionMode
            ? 'We prefill everything we can from the quote. Review the details and supply the missing order info before creating it.'
            : 'Order numbers are generated for you, starting at 1001. Gather every part, attachment, and add-on service before the job hits the floor.'}
        </p>
        {conversionMode && (
          <p className="text-sm text-muted-foreground">
            Quote ID: <code className="rounded bg-muted px-1 py-0.5 text-xs">{quoteId}</code>
          </p>
        )}
        {quotePrefillLoading && conversionMode && (
          <p className="text-sm text-muted-foreground">Prefilling from quote…</p>
        )}
        {quotePrefillError && <p className="text-sm text-destructive">{quotePrefillError}</p>}
      </div>

      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Customer & schedule</CardTitle>
            <CardDescription>Who is the work for and when do they need it?</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="business">Business</Label>
              <Select
                value={business}
                disabled={conversionMode}
                onValueChange={(value) => setBusiness(value as BusinessCode)}
              >
                <SelectTrigger id="business" className="border-border/60 bg-background/80">
                  <SelectValue placeholder="Select a business" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.prefix} — {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={conversionMode}>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 text-sm text-primary"
                    disabled={conversionMode}
                  >
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
            <CardTitle>Custom intake fields</CardTitle>
            <CardDescription>Additional fields configured for this business.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomFieldInputs
              fields={customFields}
              values={customFieldValues}
              onChange={(fieldId, value) =>
                setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
              }
            />
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
                    <Label>Stock size (optional)</Label>
                    <Input
                      value={part.stockSize || ''}
                      onChange={(e) => updatePart(index, { stockSize: e.target.value })}
                      placeholder="e.g. 2in x 12in bar"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Cut length (optional)</Label>
                    <Input
                      value={part.cutLength || ''}
                      onChange={(e) => updatePart(index, { cutLength: e.target.value })}
                      placeholder="e.g. 6.5 in"
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

        {conversionMode ? (
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Existing quote attachments will copy to the order automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Uploads from this screen are disabled while converting a quote. Add attachments to the quote first to have them copied into the order folder.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>Link drawings, STEP files, or upload lightweight references.</CardDescription>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground md:text-right">
                    Storage business
                  </Label>
                  <Select value={attachmentBusiness} onValueChange={(value) => setAttachmentBusiness(value as BusinessName)}>
                    <SelectTrigger className="w-[220px] border-border/60 bg-background/80">
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
                </div>
                <p className="text-xs text-muted-foreground md:text-right">
                  Files upload to{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{attachmentPathPreview}</code>
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full border border-primary/40 bg-primary/10 text-primary"
                  onClick={addAttachmentRow}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add attachment
                </Button>
              </div>
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
                      <Label>Mime type</Label>
                      <Input
                        value={att.mimeType}
                        onChange={(e) => updateAttachment(index, { mimeType: e.target.value })}
                        placeholder="application/step"
                      />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>External link</Label>
                      <Input
                        value={att.url}
                        onChange={(e) => handleAttachmentUrlChange(index, e.target.value)}
                        placeholder="Paste Google Drive or SharePoint link"
                        disabled={att.uploading}
                      />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Upload file</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Input
                          type="file"
                          className="bg-background/80"
                          onChange={(e) => void handleAttachmentFile(index, e.target.files)}
                          disabled={att.uploading}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          {att.uploading ? 'Uploading…' : 'Drop a file to upload'}
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Uploads are written to the shared storage above for easy access on the shop floor.</p>
                        {att.storagePath ? (
                          <p className="flex flex-wrap items-center gap-1">
                            Stored file:
                            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{att.storagePath}</code>
                            <a
                              href={`/attachments/${att.storagePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline"
                            >
                              Open stored copy
                            </a>
                          </p>
                        ) : (
                          <p>Add a file to copy it into shared storage.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Add-ons & notes</CardTitle>
            <CardDescription>
              {conversionMode
                ? 'Add-ons will be pulled from the quote parts during conversion.'
                : 'Select value-added services and include launch notes.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {!conversionMode && (
              <div className="grid gap-2">
                <Label>Add-on services</Label>
                <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-4 sm:grid-cols-2">
                  {addons.map((item) => {
                    const checked = selectedAddonIds.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-muted/10 p-3 text-sm">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const isChecked = value === true;
                              setSelectedAddonIds((sel) =>
                                isChecked ? [...sel, item.id] : sel.filter((id) => id !== item.id)
                              );
                            }}
                          />
                          <div className="space-y-1">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.description && (
                              <span className="block text-xs text-muted-foreground">{item.description}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground text-right">
                          Pricing available in Admin Portal
                        </span>
                      </label>
                    );
                  })}
                  {addons.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No add-ons available yet. Create them from the admin dashboard.
                    </p>
                  )}
                </div>
              </div>
            )}
            {conversionMode && (
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                Add-ons and labor will copy from the quote parts and become part-level charges on the order.
              </div>
            )}
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

export default function NewOrderPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading order form…</div>}>
      <NewOrderForm />
    </React.Suspense>
  );
}
