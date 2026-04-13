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
import { AvailableItemsLibrary } from '@/components/AvailableItemsLibrary';
import { AssignedItemsPanel } from '@/components/AssignedItemsPanel';
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
import {
  calculateAssignmentTotalCents,
  calculateWorkItemsSubtotalCents,
  getWorkItemPricingSemantic,
} from '@/modules/pricing/work-item-pricing';
import { calculatePartLotTotal, type PartPricingMode } from '@/modules/pricing/part-pricing';
import type { RepeatOrderTemplateDetail } from '@/modules/repeat-orders/repeat-orders.types';

const priorities = ['LOW', 'NORMAL', 'RUSH', 'HOT'];
const OPTIONAL_VALUE = '__none__';

const createKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const DEFAULT_BUSINESS_OPTION = BUSINESS_OPTIONS[0];
const DEFAULT_BUSINESS_NAME = (DEFAULT_BUSINESS_OPTION?.name ?? 'Sterling Tool and Die') as BusinessName;
const DEFAULT_BUSINESS_CODE = (DEFAULT_BUSINESS_OPTION?.code ?? 'STD') as BusinessCode;
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

type Option = { id: string; name: string };
type AddonOption = {
  id: string;
  name: string;
  description?: string | null;
  rateType?: 'HOURLY' | 'FLAT';
  rateCents?: number;
  active?: boolean;
  affectsPrice?: boolean;
  isChecklistItem?: boolean;
  department?: { id: string; name: string } | null;
};
type PartAddonSelection = {
  key: string;
  addonId: string;
  units: string;
  notes: string;
};
type PartInput = {
  key: string;
  templatePartId?: string;
  partNumber: string;
  quantity: number;
  materialId?: string;
  stockSize?: string;
  cutLength?: string;
  notes?: string;
  workInstructions?: string;
  addonSelections: PartAddonSelection[];
  templateCharges?: RepeatOrderTemplateDetail['parts'][number]['charges'];
  templateAttachments?: RepeatOrderTemplateDetail['parts'][number]['attachments'];
};

type PartPricingState = {
  partKey: string;
  price: string;
  pricingMode: PartPricingMode;
};
type AttachmentInput = { url: string; storagePath: string; label: string; mimeType: string; uploading?: boolean };

const emptyPart = (): PartInput => ({
  key: createKey(),
  templatePartId: undefined,
  partNumber: '',
  quantity: 1,
  materialId: '',
  stockSize: '',
  cutLength: '',
  notes: '',
  workInstructions: '',
  addonSelections: [],
  templateCharges: [],
  templateAttachments: [],
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

const buildConversionWorkInstructions = (quote: any, part: any) => {
  const toBulletLines = (value: unknown) =>
    String(value ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`);
  const buildSection = (heading: string, value: unknown) => {
    const items = toBulletLines(value);
    if (!items.length) return '';
    return `${heading}:\n${items.join('\n')}`;
  };

  const sections = [
    buildSection('Quote requirements', quote?.requirements),
    buildSection('Quote notes', quote?.notes),
    buildSection('Materials', quote?.materialSummary),
    buildSection('Purchase items', quote?.purchaseItems),
    buildSection('Part-specific notes', part?.notes),
  ].filter(Boolean);
  return sections.join('\n\n').trim();
};

const defaultDueDate = () => {
  const base = new Date();
  base.setDate(base.getDate() + 14);
  return base.toISOString().slice(0, 10);
};

const numberFromString = (value: string) => {
  const parsed = Number.parseFloat(value || '0');
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
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
  const [partPricing, setPartPricing] = React.useState<PartPricingState[]>([{ partKey: parts[0]?.key ?? createKey(), price: '0.00', pricingMode: 'LOT_TOTAL' }]);
  const [activePartKey, setActivePartKey] = React.useState(parts[0]?.key ?? createKey());
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
  const [repeatTemplate, setRepeatTemplate] = React.useState<RepeatOrderTemplateDetail | null>(null);
  const [repeatTemplateError, setRepeatTemplateError] = React.useState<string | null>(null);
  const [repeatTemplateLoading, setRepeatTemplateLoading] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const templateId = searchParams.get('templateId');
  const quoteId = searchParams.get('quoteId');
  const templateMode = Boolean(templateId);
  const conversionMode = !templateMode && Boolean(quoteId);
  const steps = [
    { key: 'info', label: 'Order info' },
    { key: 'parts', label: 'Parts' },
    { key: 'review', label: 'Review & create' },
  ];
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
    if (!templateId) {
      setRepeatTemplate(null);
      setRepeatTemplateError(null);
      setRepeatTemplateLoading(false);
      return;
    }
    setRepeatTemplateLoading(true);
    setRepeatTemplateError(null);
    fetch(`/api/repeat-order-templates/${templateId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const template = data?.template;
        if (!template) throw new Error('Repeat-order template not found');
        setRepeatTemplate(template);
        setBusiness(template.business as BusinessCode);
        setCustomerId(template.customerId ?? '');
        setVendorId(template.vendorId ?? '');
        setAssignedMachinistId('');
        setPoNumber('');
        setPriority(template.priority ?? 'NORMAL');
        setDueDate(defaultDueDate());
        setMaterialNeeded(Boolean(template.materialNeeded));
        setMaterialOrdered(Boolean(template.materialOrdered));
        setModelIncluded(Boolean(template.modelIncluded));
        setNotes(template.notes ?? '');
        setSelectedAddonIds([]);
        setCustomFieldValues({});
        setParts(
          (template.parts ?? []).length
            ? [...template.parts]
                .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((part: any) => ({
                  key: createKey(),
                  templatePartId: part.id,
                  partNumber: part.partNumber ?? '',
                  quantity: part.quantity ?? 1,
                  materialId: part.materialId ?? '',
                  stockSize: part.stockSize ?? '',
                  cutLength: part.cutLength ?? '',
                  notes: part.notes ?? '',
                  workInstructions: part.workInstructions ?? '',
                  addonSelections: [],
                  templateCharges: Array.isArray(part.charges) ? part.charges : [],
                  templateAttachments: Array.isArray(part.attachments) ? part.attachments : [],
                }))
            : [emptyPart()]
        );
      })
      .catch(() => {
        setRepeatTemplate(null);
        setRepeatTemplateError('Unable to prefill from repeat template. You can choose another template or start a manual order.');
      })
      .finally(() => setRepeatTemplateLoading(false));
  }, [templateId]);

  React.useEffect(() => {
    if (templateMode || !quoteId) return;
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
            ? (() => {
                const legacySelections = (quote.addonSelections ?? []).filter((selection: any) => !selection.quotePartId);
                return quote.parts.map((part: any, index: number) => {
                  const selections = part.addonSelections?.length
                    ? part.addonSelections
                    : index === 0
                      ? legacySelections
                      : [];
                  return {
                    key: createKey(),
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
                    workInstructions: buildConversionWorkInstructions(quote, part),
                    addonSelections: selections.map((selection: any) => ({
                      key: createKey(),
                      addonId: selection.addonId ?? selection.addon?.id ?? '',
                      units: String(selection.units ?? 1),
                      notes: selection.notes ?? '',
                    })),
                  };
                });
              })()
            : [emptyPart()],
        );
        const quoteAddonIds = new Set<string>();
        const quoteAddonSnapshots = new Map<string, AddonOption>();
        (quote.parts ?? []).forEach((part: any) => {
          (part.addonSelections ?? []).forEach((sel: any) => {
            const addonId = sel.addon?.id ?? sel.addonId ?? null;
            if (addonId) quoteAddonIds.add(addonId);
            if (addonId && sel.addon) {
              quoteAddonSnapshots.set(addonId, {
                id: addonId,
                name: sel.addon.name ?? 'Unnamed add-on',
                description: sel.addon.description ?? null,
                rateType: sel.addon.rateType ?? undefined,
                rateCents:
                  typeof sel.addon.rateCents === 'number'
                    ? sel.addon.rateCents
                    : typeof sel.rateCents === 'number'
                    ? sel.rateCents
                    : undefined,
                active: true,
                affectsPrice:
                  typeof sel.addon.affectsPrice === 'boolean'
                    ? sel.addon.affectsPrice
                    : typeof sel.affectsPrice === 'boolean'
                    ? sel.affectsPrice
                    : true,
                isChecklistItem:
                  typeof sel.addon.isChecklistItem === 'boolean'
                    ? sel.addon.isChecklistItem
                    : typeof sel.isChecklistItem === 'boolean'
                    ? sel.isChecklistItem
                    : false,
                department:
                  sel.addon.department && sel.addon.department.id
                    ? {
                        id: sel.addon.department.id,
                        name: sel.addon.department.name ?? 'Department',
                      }
                    : null,
              });
            }
          });
        });
        (quote.addonSelections ?? []).forEach((sel: any) => {
          const addonId = sel.addon?.id ?? sel.addonId ?? null;
          if (addonId) quoteAddonIds.add(addonId);
          if (addonId && sel.addon) {
            quoteAddonSnapshots.set(addonId, {
              id: addonId,
              name: sel.addon.name ?? 'Unnamed add-on',
              description: sel.addon.description ?? null,
              rateType: sel.addon.rateType ?? undefined,
              rateCents:
                typeof sel.addon.rateCents === 'number'
                  ? sel.addon.rateCents
                  : typeof sel.rateCents === 'number'
                  ? sel.rateCents
                  : undefined,
              active: true,
              affectsPrice:
                typeof sel.addon.affectsPrice === 'boolean'
                  ? sel.addon.affectsPrice
                  : typeof sel.affectsPrice === 'boolean'
                  ? sel.affectsPrice
                  : true,
              isChecklistItem:
                typeof sel.addon.isChecklistItem === 'boolean'
                  ? sel.addon.isChecklistItem
                  : typeof sel.isChecklistItem === 'boolean'
                  ? sel.isChecklistItem
                  : false,
              department:
                sel.addon.department && sel.addon.department.id
                  ? {
                      id: sel.addon.department.id,
                      name: sel.addon.department.name ?? 'Department',
                    }
                  : null,
            });
          }
        });
        setSelectedAddonIds(Array.from(quoteAddonIds));
        if (quoteAddonSnapshots.size > 0) {
          setAddons((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const missing = Array.from(quoteAddonSnapshots.values()).filter((item) => !existingIds.has(item.id));
            return missing.length ? [...prev, ...missing] : prev;
          });
        }
        setDueDate((quote.dueDate as string | null)?.slice(0, 10) || defaultDueDate());
        setNotes((prev) => prev || buildConversionNote(quote));
      })
      .catch(() => {
        setQuotePrefillError('Unable to prefill from quote. You can still create the order manually.');
      })
      .finally(() => setQuotePrefillLoading(false));
  }, [quoteId, templateMode]);

  React.useEffect(() => {
    if (!parts.length) return;
    if (parts.some((part) => part.key === activePartKey)) return;
    setActivePartKey(parts[0]?.key ?? createKey());
  }, [activePartKey, parts]);

  React.useEffect(() => {
    setPartPricing((prev) => {
      const byPartKey = new Map(prev.map((entry) => [entry.partKey, entry]));
      return parts.map((part) => byPartKey.get(part.key) ?? { partKey: part.key, price: '0.00', pricingMode: 'LOT_TOTAL' });
    });
  }, [parts]);

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

  const activePart = React.useMemo(
    () => parts.find((part) => part.key === activePartKey) ?? parts[0],
    [activePartKey, parts],
  );
  const templateOrderAttachments = React.useMemo(
    () => (Array.isArray(repeatTemplate?.attachments) ? repeatTemplate.attachments : []),
    [repeatTemplate?.attachments],
  );
  const templatePartAttachmentEntries = React.useMemo(
    () =>
      parts.flatMap((part, index) =>
        (part.templateAttachments ?? []).map((attachment, attachmentIndex) => ({
          key: `${part.key}-${attachment.id ?? attachmentIndex}`,
          partLabel: part.partNumber || `Part ${index + 1}`,
          attachment,
        })),
      ),
    [parts],
  );
  const availableItems = React.useMemo(
    () =>
      addons.map((addon) => ({
        id: addon.id,
        name: addon.name,
        description: addon.description,
        rateType: addon.rateType,
        rateCents: typeof addon.rateCents === 'number' ? addon.rateCents : undefined,
        departmentName: addon.department?.name ?? null,
        affectsPrice: addon.affectsPrice ?? true,
        isChecklistItem: addon.isChecklistItem ?? false,
      })),
    [addons],
  );
  const availableItemsById = React.useMemo(
    () => new Map(availableItems.map((item) => [item.id, item])),
    [availableItems],
  );
  const orderChecklistAddons = React.useMemo(
    () => addons.filter((addon) => addon.isChecklistItem && !addon.affectsPrice),
    [addons],
  );
  const addonLaborSubtotalCents = React.useMemo(
    () =>
      parts.reduce(
        (sum, part) =>
          sum +
          calculateWorkItemsSubtotalCents({
            selections: part.addonSelections.map((selection) => ({
              addonId: selection.addonId,
              units: numberFromString(selection.units),
            })),
            itemsById: availableItemsById,
          }),
        0,
      ),
    [availableItemsById, parts],
  );
  const partPricingTotalCents = React.useMemo(
    () =>
      partPricing.reduce((sum, entry) => {
        const part = parts.find((candidate) => candidate.key === entry.partKey);
        const quantity = Number.isFinite(part?.quantity) ? Number(part?.quantity) : 1;
        return (
          sum +
          calculatePartLotTotal({
            enteredPriceCents: Math.round(numberFromString(entry.price) * 100),
            quantity,
            pricingMode: entry.pricingMode,
          })
        );
      }, 0),
    [partPricing, parts],
  );
  const totalEstimateCents = addonLaborSubtotalCents + partPricingTotalCents;

  function updatePart(key: string, patch: Partial<PartInput>) {
    setParts((prev) => prev.map((part) => (part.key === key ? { ...part, ...patch } : part)));
  }

  function addAddonSelection(partKey: string, addonId: string) {
    setParts((prev) =>
      prev.map((part) =>
        part.key === partKey
          ? {
              ...part,
              addonSelections: [
                ...part.addonSelections,
                { key: createKey(), addonId, units: '1.0', notes: '' },
              ],
            }
          : part
      )
    );
  }

  function updateAddonSelection(partKey: string, selectionKey: string, patch: Partial<PartAddonSelection>) {
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

  function moveAddonSelection(partKey: string, selectionKey: string, direction: 'up' | 'down') {
    setParts((prev) =>
      prev.map((part) => {
        if (part.key !== partKey) return part;
        const index = part.addonSelections.findIndex((selection) => selection.key === selectionKey);
        if (index < 0) return part;
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= part.addonSelections.length) return part;
        const updated = [...part.addonSelections];
        const [moved] = updated.splice(index, 1);
        updated.splice(nextIndex, 0, moved);
        return { ...part, addonSelections: updated };
      })
    );
  }

  function addPartRow() {
    const nextPart = emptyPart();
    setParts((prev) => [...prev, nextPart]);
    setActivePartKey(nextPart.key);
  }

  function removePart(key: string) {
    setParts((prev) => (prev.length === 1 ? prev : prev.filter((part) => part.key !== key)));
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
        addonSelections: part.addonSelections
          .filter((selection) => selection.addonId)
          .map((selection) => {
            const units = Number.parseFloat(selection.units);
            return {
              addonId: selection.addonId,
              units: Number.isFinite(units) ? units : 0,
              notes: selection.notes?.trim() ? selection.notes.trim() : undefined,
            };
          }),
      }))
      .filter((part) => part.partNumber.length > 0);
    const cleanedTemplateParts = parts
      .map((part) => ({
        templatePartId: part.templatePartId?.trim() || '',
        quantity: Number.isFinite(part.quantity) ? part.quantity : 1,
        notes: part.notes?.trim() ? part.notes.trim() : null,
        workInstructions: part.workInstructions?.trim() ? part.workInstructions.trim() : null,
      }))
      .filter((part) => part.templatePartId.length > 0);

    if (!customerId) {
      setMessage('Please choose a customer.');
      setLoading(false);
      return;
    }

    if (!templateMode && cleanedParts.length === 0) {
      setMessage('Add at least one part with a part number.');
      setLoading(false);
      return;
    }

    if (templateMode && (!templateId || cleanedTemplateParts.length === 0)) {
      setMessage('This repeat template did not load correctly. Please reload it from the customer or order screen.');
      setLoading(false);
      return;
    }

    if (attachments.some((att) => att.uploading)) {
      setMessage('Please wait for attachment uploads to finish.');
      setLoading(false);
      return;
    }

    const missingFields = templateMode
      ? []
      : customFields.filter((field) => field.isRequired && !hasCustomFieldValue(customFieldValues[field.id]));
    if (!templateMode && missingFields.length) {
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

    if (templateMode && templateId) {
      const res = await fetch(`/api/repeat-order-templates/${templateId}/create-order`, {
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
          notes: notes.trim() || undefined,
          parts: cleanedTemplateParts,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const newId = typeof data?.id === 'string' ? data.id : null;
        setMessage('Repeat order created.');
        setCreatedOrderId(newId);
        if (newId) {
          router.push(`/orders/${newId}`);
        }
      } else {
        const errorMessage = await extractErrorMessage(res, 'Repeat-order creation failed. Please try again.');
        setMessage(errorMessage);
        setCreatedOrderId(null);
      }
      setLoading(false);
      return;
    }

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
        const errorMessage = await extractErrorMessage(res, 'Conversion failed. Please try again.');
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
        router.push('/');
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
      const errorMessage = await extractErrorMessage(res, 'Error creating order. Please try again.');
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
          {templateMode ? 'Create a repeat order' : conversionMode ? 'Convert quote to order' : 'Create a production order'}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {templateMode
            ? 'This order is prefilled from a frozen repeat template. Review the launch details, tweak the PO and part-specific notes, and send it back to the floor.'
            : conversionMode
            ? 'We prefill everything we can from the quote. Review the details and supply the missing order info before creating it.'
            : 'Order numbers are generated for you, starting at 1001. Gather every part, attachment, and add-on service before the job hits the floor.'}
        </p>
        {templateMode && repeatTemplate && (
          <p className="text-sm text-muted-foreground">
            Template: <code className="rounded bg-muted px-1 py-0.5 text-xs">{repeatTemplate.name}</code>
            {repeatTemplate.sourceOrderNumber ? (
              <>
                {' '}from order{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{repeatTemplate.sourceOrderNumber}</code>
              </>
            ) : null}
          </p>
        )}
        {templateMode && repeatTemplate ? (
          <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Repeat Launch</p>
              <p className="text-sm text-foreground">
                This screen is for launching a fresh order from a frozen template.
                You can change scheduling, PO, assignment, part notes, and work instructions.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">Editable: PO, due date, priority</span>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">Editable: part notes + work instructions</span>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">Frozen: routing, charges, template files</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Parts</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{parts.length}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Order Files</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{templateOrderAttachments.length}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Part Files</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{templatePartAttachmentEntries.length}</div>
              </div>
            </div>
          </div>
        ) : null}
        {conversionMode && (
          <p className="text-sm text-muted-foreground">
            Quote ID: <code className="rounded bg-muted px-1 py-0.5 text-xs">{quoteId}</code>
          </p>
        )}
        {repeatTemplateLoading && templateMode && (
          <p className="text-sm text-muted-foreground">Prefilling from repeat template...</p>
        )}
        {repeatTemplateError && <p className="text-sm text-destructive">{repeatTemplateError}</p>}
        {quotePrefillLoading && conversionMode && (
          <p className="text-sm text-muted-foreground">Prefilling from quote…</p>
        )}
        {quotePrefillError && <p className="text-sm text-destructive">{quotePrefillError}</p>}
      </div>

      <div className="rounded border border-border/60 bg-card/70 p-4 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <Button
              key={step.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(index)}
              className={`rounded-full border px-4 py-2 text-sm ${
                index === currentStep
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
              {step.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 h-1 w-full rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        {currentStep === 0 && (
          <>
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
                disabled={conversionMode || templateMode}
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
              <Select value={customerId} onValueChange={setCustomerId} disabled={conversionMode || templateMode}>
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
                    disabled={conversionMode || templateMode}
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

            {!templateMode && (
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
            )}

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
          </>
        )}

        {currentStep === 1 && (
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Parts in this order</CardTitle>
                <CardDescription>
                  {templateMode
                    ? 'Review the saved part setup, then adjust only what this repeat run needs.'
                    : 'Track every unique part, quantity, and preferred material.'}
                </CardDescription>
              </div>
              {!templateMode && (
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full border border-primary/40 bg-primary/10 text-primary"
                  onClick={addPartRow}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add part
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <AvailableItemsLibrary
                title="Available items library"
                description={
                  templateMode
                    ? 'Charges and checklist structure come from the repeat template and are read-only here.'
                    : conversionMode
                    ? 'Add-ons come from the quote and are read-only here.'
                    : 'Drag items onto the selected part or click Add.'
                }
                items={availableItems}
                onAddItem={(item) => {
                  if (!activePart || conversionMode || templateMode) return;
                  addAddonSelection(activePart.key, item.id);
                }}
                disabled={conversionMode || templateMode}
              />
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parts list</p>
                      <p className="text-xs text-muted-foreground">
                        {templateMode ? 'Select a part to review notes, work instructions, and saved files.' : 'Select a part to assign add-ons.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {parts.map((part, index) => (
                      <Button
                        key={part.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActivePartKey(part.key)}
                        className={`justify-start ${
                          part.key === activePartKey
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {part.partNumber || `Part ${index + 1}`}
                      </Button>
                    ))}
                  </div>
                </div>
                {activePart ? (
                  <>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Selected part
                        </h3>
                        {!templateMode && parts.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removePart(activePart.key)}>
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Part number</Label>
                          <Input
                            value={activePart.partNumber}
                            onChange={(e) => updatePart(activePart.key, { partNumber: e.target.value })}
                            placeholder="e.g. SP-1024"
                            disabled={templateMode}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min={1}
                            value={activePart.quantity}
                            onChange={(e) => updatePart(activePart.key, { quantity: Number(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Stock size (optional)</Label>
                          <Input
                            value={activePart.stockSize || ''}
                            onChange={(e) => updatePart(activePart.key, { stockSize: e.target.value })}
                            placeholder="e.g. 2in x 12in bar"
                            disabled={templateMode}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Cut length (optional)</Label>
                          <Input
                            value={activePart.cutLength || ''}
                            onChange={(e) => updatePart(activePart.key, { cutLength: e.target.value })}
                            placeholder="e.g. 6.5 in"
                            disabled={templateMode}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Preferred material</Label>
                          <Select
                            value={activePart.materialId || OPTIONAL_VALUE}
                            onValueChange={(value) =>
                              updatePart(activePart.key, { materialId: value === OPTIONAL_VALUE ? '' : value })
                            }
                            disabled={templateMode}
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
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={activePart.notes}
                            onChange={(e) => updatePart(activePart.key, { notes: e.target.value })}
                            placeholder="Surface finish, tolerances, tooling, etc."
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Work instructions</Label>
                          <Textarea
                            value={activePart.workInstructions || ''}
                            onChange={(e) => updatePart(activePart.key, { workInstructions: e.target.value })}
                            placeholder="Must-read floor instructions for this part."
                            className="min-h-[120px]"
                          />
                        </div>
                        {templateMode && (
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Work instructions</Label>
                            <Textarea
                              value={activePart.workInstructions || ''}
                              onChange={(e) => updatePart(activePart.key, { workInstructions: e.target.value })}
                              placeholder="Required setup or must-read instructions for this part"
                              className="min-h-[140px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {templateMode ? (
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Saved process items
                          </h3>
                          <div className="mt-3 space-y-3">
                            {(activePart.templateCharges ?? []).length ? (
                              (activePart.templateCharges ?? []).map((charge, index) => (
                                <div key={charge.id ?? `${charge.name}-${index}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-foreground">{charge.name}</span>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{charge.kind}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Qty {charge.quantity} at ${charge.unitPrice} each
                                  </div>
                                  {charge.description ? (
                                    <p className="mt-2 text-sm text-muted-foreground">{charge.description}</p>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">No saved charges on this part.</p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Saved part files
                          </h3>
                          <div className="mt-3 space-y-3">
                            {(activePart.templateAttachments ?? []).length ? (
                              (activePart.templateAttachments ?? []).map((attachment, index) => {
                                const href = attachment.storagePath
                                  ? `/attachments/${attachment.storagePath}`
                                  : attachment.url;
                                return (
                                  <div key={attachment.id ?? `${attachment.label}-${index}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm">
                                    <div className="font-medium text-foreground">{attachment.label || 'Template attachment'}</div>
                                    <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                                      {attachment.kind}
                                    </div>
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex font-medium text-primary hover:underline"
                                      >
                                        Open file
                                      </a>
                                    ) : null}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-muted-foreground">No saved files on this part.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <AssignedItemsPanel
                        title="Assigned add-ons & labor"
                        description={
                          conversionMode
                            ? 'Add-ons are read-only while converting from a quote.'
                            : 'Drop items here or use Add from the library.'
                        }
                        assignments={activePart.addonSelections.map((selection) => ({
                          key: selection.key,
                          itemId: selection.addonId,
                          units: selection.units,
                          notes: selection.notes,
                        }))}
                        itemsById={availableItemsById}
                        onAddItem={(itemId) => {
                          if (conversionMode || templateMode) return;
                          addAddonSelection(activePart.key, itemId);
                        }}
                        onUpdateAssignment={(key, patch) => {
                          if (conversionMode || templateMode) return;
                          const updates: Partial<PartAddonSelection> = {};
                          if (patch.units !== undefined) updates.units = patch.units;
                          if (patch.notes !== undefined) updates.notes = patch.notes;
                          updateAddonSelection(activePart.key, key, updates);
                        }}
                        onRemoveAssignment={(key) => {
                          if (conversionMode || templateMode) return;
                          removeAddonSelection(activePart.key, key);
                        }}
                        onMoveAssignment={(key, direction) => {
                          if (conversionMode || templateMode) return;
                          moveAddonSelection(activePart.key, key, direction);
                        }}
                        renderMeta={(assignment, item) => {
                          if (!item) return null;
                          if (getWorkItemPricingSemantic(item) === 'CHECKLIST_ONLY') {
                            return (
                              <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                No charge (checklist only).
                              </div>
                            );
                          }
                          if (typeof item.rateCents !== 'number') {
                            return (
                              <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                Price unavailable for this add-on.
                              </div>
                            );
                          }
                          const units = numberFromString(assignment.units);
                          const totalCents = calculateAssignmentTotalCents({ item, units });
                          return (
                            <div className="rounded border border-border/60 bg-background px-3 py-2 text-sm">
                              {formatCurrency(item.rateCents)} x {units.toFixed(2)} = {formatCurrency(totalCents)}
                            </div>
                          );
                        }}
                        disabled={conversionMode || templateMode}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a part to edit details.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <>

            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Per-part pricing basis</CardTitle>
                <CardDescription>
                  Review-only estimate controls. This basis is not persisted on order create.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {parts.map((part, index) => {
                  const entry = partPricing.find((candidate) => candidate.partKey === part.key) ?? {
                    partKey: part.key,
                    price: '0.00',
                    pricingMode: 'LOT_TOTAL' as PartPricingMode,
                  };
                  const quantity = Number.isFinite(part.quantity) ? Number(part.quantity) : 1;
                  const lotTotal = calculatePartLotTotal({
                    enteredPriceCents: Math.round(numberFromString(entry.price) * 100),
                    quantity,
                    pricingMode: entry.pricingMode,
                  });
                  return (
                    <div key={part.key} className="grid gap-3 rounded border border-border/60 bg-background/60 p-3 md:grid-cols-[1.5fr_100px_160px_140px_auto] md:items-center">
                      <div className="text-sm font-medium">{part.partNumber || `Part ${index + 1}`}</div>
                      <div className="text-sm text-muted-foreground">Qty: {quantity}</div>
                      <Input
                        inputMode="decimal"
                        value={entry.price}
                        onChange={(event) =>
                          setPartPricing((prev) =>
                            prev.map((row) => (row.partKey === part.key ? { ...row, price: event.target.value } : row)),
                          )
                        }
                        placeholder="0.00"
                      />
                      <Label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={entry.pricingMode === 'PER_UNIT'}
                          onCheckedChange={(checked) =>
                            setPartPricing((prev) =>
                              prev.map((row) =>
                                row.partKey === part.key ? { ...row, pricingMode: checked ? 'PER_UNIT' : 'LOT_TOTAL' } : row,
                              ),
                            )
                          }
                        />
                        PER_UNIT
                      </Label>
                      <div className="text-sm font-medium">{formatCurrency(lotTotal)}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Estimate summary</CardTitle>
                <CardDescription>Pricing projection from assigned add-ons and labor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Add-ons & labor subtotal</span>
                  <span className="font-medium">{formatCurrency(addonLaborSubtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
                  <span className="text-muted-foreground">Part pricing (basis-adjusted)</span>
                  <span className="font-medium">{formatCurrency(partPricingTotalCents)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 font-semibold">
                  <span>Total estimate</span>
                  <span>{formatCurrency(totalEstimateCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Checklist-only items are excluded from pricing totals.
                </p>
              </CardContent>
            </Card>

            {templateMode ? (
              <Card className="border-border/60 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle>Template files</CardTitle>
                  <CardDescription>Saved order files and part files will copy into the new order automatically.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Order-level files</p>
                    {templateOrderAttachments.length ? (
                      templateOrderAttachments.map((attachment, index) => {
                        const href = attachment.storagePath ? `/attachments/${attachment.storagePath}` : attachment.url;
                        return (
                          <div key={attachment.id ?? `${attachment.label}-${index}`} className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                            <div className="font-medium text-foreground">{attachment.label || 'Template attachment'}</div>
                            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                              {attachment.kind}
                            </div>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-medium text-primary hover:underline">
                                Open file
                              </a>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No order-level files saved on this template.</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Part files</p>
                    {templatePartAttachmentEntries.length ? (
                      templatePartAttachmentEntries.map((entry) => {
                        const href = entry.attachment.storagePath
                          ? `/attachments/${entry.attachment.storagePath}`
                          : entry.attachment.url;
                        return (
                          <div key={entry.key} className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                            <div className="font-medium text-foreground">{entry.attachment.label || 'Template attachment'}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.partLabel} · {entry.attachment.kind}
                            </div>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-medium text-primary hover:underline">
                                Open file
                              </a>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No part files saved on this template.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : conversionMode ? (
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
                <CardTitle>Checklist items & notes</CardTitle>
                <CardDescription>
                  {templateMode
                    ? 'Charges, checklist structure, and saved notes are coming from the repeat template.'
                    : conversionMode
                    ? 'Checklist items will be pulled from the quote parts during conversion.'
                    : 'Select checklist items that should be applied to every part.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                {!conversionMode && !templateMode && (
                  <div className="grid gap-2">
                    <Label>Checklist items (applied per part)</Label>
                    <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-4 sm:grid-cols-2">
                      {orderChecklistAddons.map((item) => {
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
                            <span className="text-xs text-muted-foreground text-right">Checklist only</span>
                          </label>
                        );
                      })}
                      {orderChecklistAddons.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No checklist-only items available yet. Create them from the admin dashboard.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {templateMode && (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                    Template charges and checklist structure will be recreated on the new order. Use the part editor above if you need to tweak per-part notes or work instructions before launch.
                  </div>
                )}
                {conversionMode && (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                    Add-ons and labor will copy from the quote parts and become part-level charges and checklist items. Mission-brief instructions will seed from quote requirements plus each part&apos;s quote notes.
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
                  <Button type="submit" disabled={loading || repeatTemplateLoading} className="rounded-full bg-primary px-6 text-primary-foreground shadow-lg shadow-primary/30">
                    {loading ? 'Submitting…' : 'Create order'}
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                    <Link href="/">Cancel</Link>
                  </Button>
                </div>
              </CardFooter>
              {(message || createdOrderId) && (
                <div className="px-6 pb-6">
                  {message && <p className={`text-sm ${createdOrderId ? 'text-primary' : 'text-destructive'}`}>{message}</p>}
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
                        onClick={() => router.push('/')}
                        className="rounded-full border-border/60 bg-background/80"
                      >
                        Back to orders
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </>
        )}

        {currentStep < steps.length - 1 && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button type="button" onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}>
              Next
            </Button>
          </div>
        )}
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
const extractErrorMessage = async (res: Response, fallback: string) => {
  try {
    const payload = await res.json();
    const direct = typeof payload?.error === 'string' ? payload.error : null;
    if (direct) return direct;
    const nested = typeof payload?.error?.message === 'string' ? payload.error.message : null;
    if (nested) return nested;
    if (payload?.error && typeof payload.error === 'object') return JSON.stringify(payload.error);
    const message = typeof payload?.message === 'string' ? payload.message : null;
    return message ?? fallback;
  } catch {
    return fallback;
  }
};

