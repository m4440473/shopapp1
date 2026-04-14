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
import { getPartPricingEntries } from '@/lib/quote-part-pricing';
import {
  BUSINESS_OPTIONS,
  getBusinessOptionByCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';
import { CustomFieldInputs, type CustomFieldDefinition } from '@/components/CustomFieldInputs';
import { hasCustomFieldValue } from '@/lib/custom-field-values';
import { AvailableItemsLibrary } from '@/components/AvailableItemsLibrary';
import { AssignedItemsPanel } from '@/components/AssignedItemsPanel';
import {
  calculateAssignmentTotalCents,
  calculatePartPricingSummaryTotalsCents,
  calculateWorkItemsSubtotalCents,
  formatWorkItemRateLabel,
  getWorkItemUnitsLabel,
  getWorkItemPricingSemantic,
  type WorkItemRateType,
} from '@/modules/pricing/work-item-pricing';
import { calculatePartLotTotal, calculatePartUnitPrice, type PartPricingMode } from '@/modules/pricing/part-pricing';
import {
  buildPresetFromSelections,
  dedupePresetItems,
  mergeSelectionsWithoutDuplicates,
  type QuoteAddonPreset,
  type QuoteAddonPresetItem,
} from '@/modules/quotes/quote-addon-bulk';
import { sumQuoteCustomAmountsCents, type QuoteCustomAmountEntry } from '@/lib/quote-metadata';

import type { QuoteCreateInput } from '@/modules/quotes/quotes.schema';

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
  rateType: WorkItemRateType;
  rateCents: number;
  active: boolean;
  affectsPrice: boolean;
  isChecklistItem: boolean;
  description?: string | null;
  department?: { id: string; name: string } | null;
};

type DepartmentOption = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
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

type QuoteCustomAmountState = {
  key: string;
  title: string;
  amount: string;
};

const QUOTE_ADDON_PRESETS_STORAGE_KEY = 'quote-addon-presets-v1';


type PartPricingState = {
  partKey: string;
  price: string;
  pricingMode: PartPricingMode;
  isManual: boolean;
};

type AttachmentState = {
  key: string;
  url: string;
  storagePath: string;
  label: string;
  mimeType: string;
  isPrintForBom: boolean;
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
  customFieldValues?: Array<{
    fieldId: string;
    value: unknown;
  }>;
  metadata?: {
    originDepartmentId?: string | null;
    partPricing?: Array<{
      name?: string | null;
      partNumber?: string | null;
      priceCents: number;
      pricingMode?: PartPricingMode;
    }>;
    customAmounts?: QuoteCustomAmountEntry[];
  } | null;
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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
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
  const [activePartKey, setActivePartKey] = useState(() => parts[0]?.key ?? createKey());

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
      isPrintForBom: Boolean((attachment.label ?? '').toUpperCase().includes('[PRINT]')),
      uploading: false,
    }))
  );
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    initialQuote?.customFieldValues?.forEach((entry) => {
      map[entry.fieldId] = entry.value;
    });
    return map;
  });
  const [currentStep, setCurrentStep] = useState(0);

  const [partPricing, setPartPricing] = useState<PartPricingState[]>(() => {
    const initialPartPricing = getPartPricingEntries({
      parts: (initialQuote?.parts ?? []).map((part) => ({
        name: part.name,
        partNumber: part.partNumber ?? null,
        addonSelections: (part.addonSelections ?? []).map((selection) => ({ totalCents: selection.totalCents ?? 0 })),
      })),
      metadata: initialQuote?.metadata,
    });
    const hasStoredPartPricing = Array.isArray(initialQuote?.metadata?.partPricing) && initialQuote.metadata.partPricing.length > 0;

    return parts.map((part, index) => {
      const entry = initialPartPricing[index];
      return {
        partKey: part.key,
        price: ((entry?.priceCents ?? 0) / 100).toFixed(2),
        pricingMode: entry?.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL',
        isManual: hasStoredPartPricing,
      } satisfies PartPricingState;
    });
  });
  const [selectedAssignmentKeys, setSelectedAssignmentKeys] = useState<string[]>([]);
  const [savedPresets, setSavedPresets] = useState<QuoteAddonPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [copyTargetPartKey, setCopyTargetPartKey] = useState<'ALL' | string>('ALL');
  const [originDepartmentId, setOriginDepartmentId] = useState(initialQuote?.metadata?.originDepartmentId ?? '');
  const [customAmounts, setCustomAmounts] = useState<QuoteCustomAmountState[]>(
    (initialQuote?.metadata?.customAmounts ?? []).map((entry, index) => ({
      key: `${initialQuote?.id ?? 'quote'}-custom-${index}`,
      title: entry.title ?? '',
      amount: ((entry.amountCents ?? 0) / 100).toFixed(2),
    }))
  );

  const steps = [
    { key: 'info', label: 'Quote info' },
    { key: 'parts', label: 'Parts' },
    { key: 'build', label: 'Build parts' },
    { key: 'review', label: 'Review & pricing' },
  ];

  const intakeCustomFields = useMemo(
    () => customFields.filter((field) => (field.uiSection ?? 'INTAKE') === 'INTAKE'),
    [customFields]
  );
  const buildCustomFields = useMemo(
    () => customFields.filter((field) => (field.uiSection ?? 'INTAKE') === 'PART_BUILD'),
    [customFields]
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

  useEffect(() => {
    setCustomFieldValues((prev) =>
      form.business === initialQuote?.business ? prev : {}
    );
    fetch(`/api/custom-fields?entityType=QUOTE&businessCode=${form.business}&isActive=true`, {
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
  }, [form.business, initialQuote?.business]);

  useEffect(() => {
    if (!parts.length) return;
    if (parts.some((part) => part.key === activePartKey)) return;
    setActivePartKey(parts[0]?.key ?? createKey());
  }, [activePartKey, parts]);

  useEffect(() => {
    setSelectedAssignmentKeys([]);
  }, [activePartKey]);

  useEffect(() => {
    const currentActivePart = parts.find((part) => part.key === activePartKey) ?? parts[0];
    if (!currentActivePart) return;
    const existingKeys = new Set(currentActivePart.addonSelections.map((selection) => selection.key));
    setSelectedAssignmentKeys((prev) => prev.filter((key) => existingKeys.has(key)));
  }, [activePartKey, parts]);

  useEffect(() => {
    setPartPricing((prev) => {
      const byPartKey = new Map(prev.map((entry) => [entry.partKey, entry]));
      const addonItemsById = new Map(addons.map((addon) => [addon.id, addon]));
      return parts.map((part) => {
        const existing = byPartKey.get(part.key);
        const autoPrice = (
          calculateWorkItemsSubtotalCents({
            selections: part.addonSelections.map((selection) => ({
              addonId: selection.addonId,
              units: numberFromString(selection.units),
            })),
            itemsById: addonItemsById,
          }) / 100
        ).toFixed(2);

        if (!existing) {
          return {
            partKey: part.key,
            price: autoPrice,
            pricingMode: 'LOT_TOTAL' as PartPricingMode,
            isManual: false,
          };
        }

        return existing.isManual ? existing : { ...existing, price: autoPrice };
      });
    });
  }, [addons, parts]);

  useEffect(() => {
    if (copyTargetPartKey === 'ALL') return;
    if (parts.some((part) => part.key === copyTargetPartKey)) return;
    setCopyTargetPartKey('ALL');
  }, [copyTargetPartKey, parts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(QUOTE_ADDON_PRESETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized: QuoteAddonPreset[] = parsed
        .map((item) => ({
          id: String(item?.id ?? createKey()),
          name: String(item?.name ?? '').trim(),
          items: dedupePresetItems(
            Array.isArray(item?.items)
              ? item.items.map((entry: any) => ({
                  addonId: String(entry?.addonId ?? '').trim(),
                  units: String(entry?.units ?? '1.0'),
                  notes: String(entry?.notes ?? ''),
                }))
              : []
          ),
        }))
        .filter((item) => item.name && item.items.length > 0);
      setSavedPresets(normalized);
    } catch {
      setSavedPresets([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(QUOTE_ADDON_PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

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
    fetch('/api/orders/addons?active=true&take=100', { credentials: 'include' })
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
            affectsPrice: item.affectsPrice ?? true,
            isChecklistItem: item.isChecklistItem ?? false,
            description: item.description,
            department: item.department ?? null,
          }))
        );
      })
      .catch(() => setAddons([]));

    fetch('/api/admin/departments', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setDepartments(data.items ?? []))
      .catch(() => setDepartments([]));

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

  function updatePart(partKey: string, patch: Partial<QuotePartState>) {
    setParts((prev) =>
      prev.map((item) => (item.key === partKey ? { ...item, ...patch } : item))
    );
  }

  function removePart(partKey: string) {
    setParts((prev) => prev.filter((item) => item.key !== partKey));
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

  function addCustomAmount() {
    setCustomAmounts((prev) => [...prev, { key: createKey(), title: '', amount: '0.00' }]);
  }

  function updateCustomAmount(customAmountKey: string, patch: Partial<QuoteCustomAmountState>) {
    setCustomAmounts((prev) =>
      prev.map((item) => (item.key === customAmountKey ? { ...item, ...patch } : item))
    );
  }

  function removeCustomAmount(customAmountKey: string) {
    setCustomAmounts((prev) => prev.filter((item) => item.key !== customAmountKey));
  }

  function addAddonSelection(partKey: string, addonId = '') {
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

  function addAttachment() {
    setAttachments((prev) => [
      ...prev,
      { key: createKey(), url: '', storagePath: '', label: '', mimeType: '', isPrintForBom: false, uploading: false },
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

  const getSelectedItemsFromPart = (part: QuotePartState): QuoteAddonPresetItem[] =>
    buildPresetFromSelections({
      selections: part.addonSelections,
      selectedKeys: selectedAssignmentKeys,
    });

  function toggleAssignmentSelection(selectionKey: string, checked: boolean) {
    setSelectedAssignmentKeys((prev) =>
      checked ? [...prev, selectionKey] : prev.filter((key) => key !== selectionKey)
    );
  }

  function selectAllActivePartAssignments() {
    if (!activePart) return;
    setSelectedAssignmentKeys(activePart.addonSelections.map((selection) => selection.key));
  }

  function clearActivePartSelections() {
    setSelectedAssignmentKeys([]);
  }

  function applySelectedItemsToAllParts() {
    if (!activePart) return;
    const selectedItems = getSelectedItemsFromPart(activePart);
    if (!selectedItems.length) {
      toast.push('Select at least one assigned item first.', 'error');
      return;
    }

    setParts((prev) =>
      prev.map((part) => ({
        ...part,
        addonSelections: mergeSelectionsWithoutDuplicates({
          existing: part.addonSelections,
          incoming: selectedItems,
          createKey,
        }),
      }))
    );
    toast.push('Selected items applied to all parts (merged without duplicates).', 'success');
  }

  function copySelectedItemsToTarget() {
    if (!activePart) return;
    const selectedItems = getSelectedItemsFromPart(activePart);
    if (!selectedItems.length) {
      toast.push('Select at least one assigned item first.', 'error');
      return;
    }

    setParts((prev) =>
      prev.map((part) => {
        const isTarget =
          copyTargetPartKey === 'ALL'
            ? part.key !== activePart.key
            : part.key === copyTargetPartKey;
        if (!isTarget) return part;
        return {
          ...part,
          addonSelections: mergeSelectionsWithoutDuplicates({
            existing: part.addonSelections,
            incoming: selectedItems,
            createKey,
          }),
        };
      })
    );
    toast.push('Selected items copied to target part(s) without duplicates.', 'success');
  }

  function savePresetFromSelection() {
    if (!activePart) return;
    const nextName = presetName.trim();
    if (!nextName) {
      toast.push('Enter a preset name before saving.', 'error');
      return;
    }
    const selectedItems = getSelectedItemsFromPart(activePart);
    if (!selectedItems.length) {
      toast.push('Select at least one assigned item first.', 'error');
      return;
    }
    const newPreset: QuoteAddonPreset = {
      id: createKey(),
      name: nextName,
      items: dedupePresetItems(selectedItems),
    };
    setSavedPresets((prev) => [newPreset, ...prev]);
    setSelectedPresetId(newPreset.id);
    setPresetName('');
    toast.push('Preset saved.', 'success');
  }

  function applyPresetToParts(target: 'ACTIVE' | 'ALL') {
    const preset = savedPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      toast.push('Select a preset first.', 'error');
      return;
    }
    setParts((prev) =>
      prev.map((part) => {
        const isTarget = target === 'ALL' ? true : part.key === activePart?.key;
        if (!isTarget) return part;
        return {
          ...part,
          addonSelections: mergeSelectionsWithoutDuplicates({
            existing: part.addonSelections,
            incoming: preset.items,
            createKey,
          }),
        };
      })
    );
    toast.push(
      target === 'ALL'
        ? `Preset "${preset.name}" applied to all parts without duplicates.`
        : `Preset "${preset.name}" applied to selected part without duplicates.`,
      'success'
    );
  }

  function deleteSelectedPreset() {
    const preset = savedPresets.find((item) => item.id === selectedPresetId);
    if (!preset) return;
    setSavedPresets((prev) => prev.filter((item) => item.id !== preset.id));
    setSelectedPresetId('');
    toast.push(`Preset "${preset.name}" removed.`, 'success');
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
  const availableItems = useMemo(
    () =>
      addons.map((addon) => ({
        id: addon.id,
        name: addon.name,
        description: addon.description,
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        departmentName: addon.department?.name ?? null,
        affectsPrice: addon.affectsPrice ?? true,
        isChecklistItem: addon.isChecklistItem ?? false,
      })),
    [addons]
  );
  const availableItemsById = useMemo(
    () => new Map(availableItems.map((item) => [item.id, item])),
    [availableItems]
  );

  const activePart = useMemo(
    () => parts.find((part) => part.key === activePartKey) ?? parts[0],
    [activePartKey, parts]
  );
  const selectedOriginDepartment = useMemo(
    () => departments.find((department) => department.id === originDepartmentId) ?? null,
    [departments, originDepartmentId]
  );
  const normalizedCustomAmounts = useMemo(
    () =>
      customAmounts
        .map((item) => ({
          key: item.key,
          title: item.title.trim(),
          amountCents: centsFromString(item.amount),
        }))
        .filter((item) => item.title.length > 0 || item.amountCents > 0),
    [customAmounts]
  );

  const vendorTotalsCents = vendorItems.reduce((sum, item) => {
    const base = centsFromString(item.basePrice);
    const markup = Number.parseFloat(item.markupPercent || '0');
    const final = Math.round(base * (1 + (Number.isNaN(markup) ? 0 : markup / 100)));
    return sum + (final > 0 ? final : 0);
  }, 0);

  const basePriceCents = centsFromString(form.basePrice);
  const pricingSummaryTotals = calculatePartPricingSummaryTotalsCents({
    parts: parts.map((part) => {
      const rawWorkItemsSubtotalCents = calculateWorkItemsSubtotalCents({
        selections: part.addonSelections.map((selection) => ({
          addonId: selection.addonId,
          units: numberFromString(selection.units),
        })),
        itemsById: addonMap,
      });
      const entry = partPricing.find((candidate) => candidate.partKey === part.key);
      const enteredPriceCents = centsFromString(entry?.price || '0');
      const quantity = Number.parseInt(part.quantity || '1', 10) || 1;

      return {
        workItemsSubtotalCents: rawWorkItemsSubtotalCents,
        partPricingSubtotalCents:
          enteredPriceCents > 0
            ? calculatePartLotTotal({
                enteredPriceCents,
                quantity,
                pricingMode: entry?.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL',
              })
            : 0,
        hasPartPricingOverride: enteredPriceCents > 0,
      };
    }),
  });
  const addonsTotalsCents = pricingSummaryTotals.addonsAndLaborCents;
  const partPricingTotalCents = pricingSummaryTotals.partPricingCents;
  const customAmountsTotalCents = sumQuoteCustomAmountsCents(normalizedCustomAmounts);
  const totalCents =
    basePriceCents + vendorTotalsCents + addonsTotalsCents + partPricingTotalCents + customAmountsTotalCents;

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
        label: (() => {
          const rawLabel = attachment.label.trim();
          if (!attachment.isPrintForBom) {
            return rawLabel || undefined;
          }
          const stripped = rawLabel.replace(/^\s*\[PRINT\]\s*/i, '').trim();
          return stripped ? `[PRINT] ${stripped}` : '[PRINT] Print image';
        })(),
        mimeType: attachment.mimeType || undefined,
      })),
    originDepartmentId: originDepartmentId || undefined,
    partPricing: parts.map((part) => {
      const entry = partPricing.find((candidate) => candidate.partKey === part.key);
      const quantity = Number.parseInt(part.quantity || '1', 10) || 1;
      const pricingMode = entry?.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL';
      return {
        name: part.name || undefined,
        partNumber: part.partNumber || undefined,
        priceCents: centsFromString(entry?.price || '0'),
        pricingMode,
      };
    }),
    customAmounts: normalizedCustomAmounts
      .filter((item) => item.title.length > 0 && item.amountCents > 0)
      .map((item) => ({
        title: item.title,
        amountCents: item.amountCents,
      })),
    customFieldValues: customFields
      .map((field) => ({ fieldId: field.id, value: customFieldValues[field.id] }))
      .filter((entry) => hasCustomFieldValue(entry.value)),
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
    const missingFields = customFields.filter(
      (field) => field.isRequired && !hasCustomFieldValue(customFieldValues[field.id])
    );
    if (missingFields.length) {
      setError(`Fill in required custom fields: ${missingFields.map((field) => field.name).join(', ')}.`);
      return;
    }
    await submitQuote();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded border border-border/60 bg-card/60 p-4">
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

      {currentStep === 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>General information</CardTitle>
              <CardDescription>Who is requesting the work and how we can reach them.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="quoteBusiness">Business *</Label>
            <Select
              value={form.business}
              onValueChange={(value) => setForm((prev) => ({ ...prev, business: value as BusinessCode }))}
            >
              <SelectTrigger id="quoteBusiness" className="border border-border bg-background px-3 py-2 text-sm">
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
            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger id="quoteStatus" className="border border-border bg-background px-3 py-2 text-sm">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom intake fields</CardTitle>
              <CardDescription>Additional fields configured for this business.</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomFieldInputs
                fields={intakeCustomFields}
                values={customFieldValues}
                onChange={(fieldId, value) =>
                  setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
                }
              />
            </CardContent>
          </Card>
        </>
      )}

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Parts</CardTitle>
            <CardDescription>Define the core part list before you add labor or files.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3 rounded border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Parts list</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextPart = buildEmptyPart();
                    setParts((prev) => [...prev, nextPart]);
                    setActivePartKey(nextPart.key);
                  }}
                >
                  Add part
                </Button>
              </div>
              <div className="space-y-2">
                {parts.map((part, index) => (
                  <Button
                    key={part.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActivePartKey(part.key)}
                    className={`w-full rounded border px-3 py-2 text-left text-sm ${
                      part.key === activePartKey
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="font-medium">{part.name || `Part ${index + 1}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {part.partNumber || 'No part number'} • Qty {part.quantity || '1'}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {activePart ? (
                <div className="rounded border border-border/60 bg-card/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Selected part</p>
                      <h3 className="text-lg font-semibold">{activePart.name || 'New part'}</h3>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removePart(activePart.key)}
                      disabled={parts.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Part name *</Label>
                      <Input
                        value={activePart.name}
                        onChange={(event) => updatePart(activePart.key, { name: event.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Part number</Label>
                      <Input
                        value={activePart.partNumber}
                        onChange={(event) => updatePart(activePart.key, { partNumber: event.target.value })}
                        placeholder="Optional part #"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={activePart.quantity}
                        onChange={(event) => updatePart(activePart.key, { quantity: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Piece count</Label>
                      <Input
                        type="number"
                        min="1"
                        value={activePart.pieceCount}
                        onChange={(event) => updatePart(activePart.key, { pieceCount: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Material</Label>
                      <Select
                        value={activePart.materialId || NO_MATERIAL_VALUE}
                        onValueChange={(value) =>
                          updatePart(activePart.key, {
                            materialId: value === NO_MATERIAL_VALUE ? '' : value,
                          })
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
                        value={activePart.stockSize}
                        onChange={(event) => updatePart(activePart.key, { stockSize: event.target.value })}
                        placeholder='e.g. "2in x 12in bar"'
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Cut length</Label>
                      <Input
                        value={activePart.cutLength}
                        onChange={(event) => updatePart(activePart.key, { cutLength: event.target.value })}
                        placeholder='e.g. "6.5 in"'
                      />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={activePart.description}
                        onChange={(event) => updatePart(activePart.key, { description: event.target.value })}
                        placeholder="What needs to happen for this part or assembly?"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a part to edit its details.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Build parts</CardTitle>
              <CardDescription>Add add-ons, labor notes, and attachments per part.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <AvailableItemsLibrary
                  title="Available items library"
                  description="Drag items onto the selected part or click Add."
                  items={availableItems}
                  onAddItem={(item) => {
                    if (!activePart) return;
                    addAddonSelection(activePart.key, item.id);
                  }}
                />
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
              <div className="space-y-4">
                <div className="rounded border border-border/60 bg-card/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Parts list</p>
                      <p className="text-xs text-muted-foreground">Select a part to assign add-ons.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextPart = buildEmptyPart();
                        setParts((prev) => [...prev, nextPart]);
                        setActivePartKey(nextPart.key);
                      }}
                    >
                      Add part
                    </Button>
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
                        {part.name || `Part ${index + 1}`}
                      </Button>
                    ))}
                  </div>
                </div>
                {activePart ? (
                  <>
                    <div className="rounded border border-border/60 bg-card/60 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Selected part</p>
                          <h3 className="text-lg font-semibold">{activePart.name || 'New part'}</h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removePart(activePart.key)}
                          disabled={parts.length === 1}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-2">
                        <Label>Part notes</Label>
                        <Textarea
                          value={activePart.notes}
                          onChange={(event) => updatePart(activePart.key, { notes: event.target.value })}
                          placeholder="Per-part requirements, fixtures, or inspection notes"
                        />
                      </div>
                    </div>
                    <AssignedItemsPanel
                      title="Assigned add-ons & labor"
                      description="Drop items here or use Add from the library."
                      assignments={activePart.addonSelections.map((selection) => ({
                        key: selection.key,
                        itemId: selection.addonId,
                        units: selection.units,
                        notes: selection.notes,
                      }))}
                      itemsById={availableItemsById}
                      onAddItem={(itemId) => addAddonSelection(activePart.key, itemId)}
                      onUpdateAssignment={(key, patch) => {
                        const updates: Partial<QuoteAddonState> = {};
                        if (patch.units !== undefined) updates.units = patch.units;
                        if (patch.notes !== undefined) updates.notes = patch.notes;
                        updateAddonSelection(activePart.key, key, updates);
                      }}
                      onRemoveAssignment={(key) => removeAddonSelection(activePart.key, key)}
                      onMoveAssignment={(key, direction) => moveAddonSelection(activePart.key, key, direction)}
                      renderMeta={(assignment) => {
                        const addon = addonMap.get(assignment.itemId);
                        if (!addon) return null;
                        if (getWorkItemPricingSemantic(addon) === 'CHECKLIST_ONLY') {
                          return (
                            <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                              No charge (checklist only).
                            </div>
                          );
                        }
                        const units = numberFromString(assignment.units);
                        const totalCents = calculateAssignmentTotalCents({ item: addon, units });
                        return (
                          <div className="rounded border border-border/60 bg-background px-3 py-2 text-sm">
                            {formatWorkItemRateLabel(addon)} x {units.toFixed(2)} {getWorkItemUnitsLabel(addon.rateType, 'short')} ={' '}
                            {formatCurrency(totalCents)}
                          </div>
                        );
                      }}
                    />
                    <div className="rounded border border-border/60 bg-background/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bulk actions for selected assignments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={selectAllActivePartAssignments}>
                            Select all
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={clearActivePartSelections}>
                            Clear
                          </Button>
                        </div>
                      </div>
                      {activePart.addonSelections.length ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {activePart.addonSelections.map((selection) => {
                            const addon = addonMap.get(selection.addonId);
                            return (
                              <label
                                key={selection.key}
                                className="flex items-center gap-2 rounded border border-border/60 px-2 py-2 text-sm"
                              >
                                <Checkbox
                                  checked={selectedAssignmentKeys.includes(selection.key)}
                                  onCheckedChange={(checked) =>
                                    toggleAssignmentSelection(selection.key, checked === true)
                                  }
                                />
                                <span className="truncate">
                                  {addon?.name ?? 'Unknown add-on'} · {selection.units || '0'} unit(s)
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Add assignments to this part before using bulk actions.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={applySelectedItemsToAllParts}>
                          Apply selected to all parts
                        </Button>
                        <Select
                          value={copyTargetPartKey}
                          onValueChange={(value) => setCopyTargetPartKey(value)}
                        >
                          <SelectTrigger className="h-9 w-[220px] border border-border bg-background px-3 text-sm">
                            <SelectValue placeholder="Copy target" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All other parts</SelectItem>
                            {parts
                              .filter((part) => part.key !== activePart.key)
                              .map((part, index) => (
                                <SelectItem key={part.key} value={part.key}>
                                  {part.name || `Part ${index + 1}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={copySelectedItemsToTarget}>
                          Copy selected items
                        </Button>
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Presets
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Save selected assignments as reusable presets. Presets merge without duplicates when applied.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Input
                          value={presetName}
                          onChange={(event) => setPresetName(event.target.value)}
                          placeholder="Preset name"
                          className="h-9 max-w-[260px]"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={savePresetFromSelection}>
                          Save preset from selected
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                          <SelectTrigger className="h-9 w-[260px] border border-border bg-background px-3 text-sm">
                            <SelectValue placeholder="Choose preset" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedPresets.length === 0 && <SelectItem value="__none__" disabled>No presets saved</SelectItem>}
                            {savedPresets.map((preset) => (
                              <SelectItem key={preset.id} value={preset.id}>
                                {preset.name} ({preset.items.length})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" onClick={() => applyPresetToParts('ACTIVE')}>
                          Apply preset to this part
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyPresetToParts('ALL')}>
                          Apply preset to all parts
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={deleteSelectedPreset}>
                          Delete preset
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a part to add add-ons and notes.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {buildCustomFields.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Part build fields</CardTitle>
                <CardDescription>Finish requirements and other build-stage details.</CardDescription>
              </CardHeader>
              <CardContent>
                <CustomFieldInputs
                  fields={buildCustomFields}
                  values={customFieldValues}
                  onChange={(fieldId, value) =>
                    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Assembly-level notes</CardTitle>
              <CardDescription>Notes and files that apply to the entire quote.</CardDescription>
            </CardHeader>
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
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Upload assembly drawings or general quote files. Mark print images so BOM analyzer workflows can prioritize them after conversion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:w-1/2">
                <Label htmlFor="quoteAttachmentBusiness">Business folder</Label>
                <Select value={attachmentBusiness} onValueChange={(value) => setAttachmentBusiness(value as BusinessName)}>
                  <SelectTrigger id="quoteAttachmentBusiness" className="border border-border bg-background px-3 py-2 text-sm">
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
                    <div className="grid gap-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Analyzer role</Label>
                      <label className="flex items-center gap-2 rounded border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                        <Checkbox
                          checked={attachment.isPrintForBom}
                          onCheckedChange={(checked) =>
                            setAttachments((prev) =>
                              prev.map((row) =>
                                row.key === attachment.key ? { ...row, isPrintForBom: checked === true } : row
                              )
                            )
                          }
                        />
                        <span>Use as print image for BOM analyzer (adds <code className="font-mono">[PRINT]</code> tag).</span>
                      </label>
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
        </>
      )}

      {currentStep === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Quote routing</CardTitle>
              <CardDescription>
                Choose the department this quote should start from when it converts to an order.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
              <div className="grid gap-2">
                <Label>Origin / default department</Label>
                <Select value={originDepartmentId || '__auto__'} onValueChange={(value) => setOriginDepartmentId(value === '__auto__' ? '' : value)}>
                  <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm">
                    <SelectValue placeholder="Use first active department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Use first active department</SelectItem>
                    {departments
                      .filter((department) => department.isActive)
                      .map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                {selectedOriginDepartment ? (
                  <p>
                    Converted orders from this quote will start in <span className="font-medium text-foreground">{selectedOriginDepartment.name}</span> unless a later workflow move changes them.
                  </p>
                ) : (
                  <p>
                    Leaving this blank keeps the current standard behavior: the order starts in the first active department.
                  </p>
                )}
              </div>
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
                        <Select
                          value={item.vendorId}
                          onValueChange={(value) => {
                            const selected = vendors.find((option) => option.id === value);
                            setVendorItems((prev) =>
                              prev.map((row) =>
                                row.key === item.key
                                  ? { ...row, vendorId: value, vendorName: selected?.name ?? '' }
                                  : row
                              )
                            );
                          }}
                        >
                          <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                                prev.map((row) =>
                                  row.key === item.key ? { ...row, markupPercent: event.target.value } : row
                                )
                              )
                            }
                            className="w-24"
                          />
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            Suggestions:
                            {MARKUP_SUGGESTIONS.map((suggestion) => (
                              <Button
                                key={suggestion}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
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
                              </Button>
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
              <CardTitle>Per-part pricing basis</CardTitle>
              <CardDescription>Set whether each entered price is per unit or lot total.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {parts.map((part, index) => {
                const entry = partPricing.find((candidate) => candidate.partKey === part.key) ?? {
                  partKey: part.key,
                  price: '0.00',
                  pricingMode: 'LOT_TOTAL' as PartPricingMode,
                };
                const quantity = Number.parseInt(part.quantity || '1', 10) || 1;
                const enteredPriceCents = centsFromString(entry.price);
                const lotTotal = calculatePartLotTotal({
                  enteredPriceCents,
                  quantity,
                  pricingMode: entry.pricingMode,
                });
                const unitPrice = calculatePartUnitPrice({
                  enteredPriceCents,
                  quantity,
                  pricingMode: entry.pricingMode,
                });
                return (
                  <div key={part.key} className="grid gap-3 rounded border border-border/60 bg-background/60 p-3 md:grid-cols-[1.5fr_160px_80px_120px_140px] md:items-center">
                    <div>
                      <p className="text-sm font-medium">{part.partNumber || part.name || `Part ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground">{part.name || 'Unnamed part'}</p>
                      <Label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={entry.pricingMode === 'PER_UNIT'}
                          onCheckedChange={(checked) =>
                            setPartPricing((prev) =>
                              prev.map((row) =>
                                row.partKey === part.key
                                  ? { ...row, pricingMode: checked ? 'PER_UNIT' : 'LOT_TOTAL' }
                                  : row
                              )
                            )
                          }
                        />
                        Mode: {entry.pricingMode}
                      </Label>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Entered price</Label>
                      <Input
                        inputMode="decimal"
                        value={entry.price}
                        onChange={(event) =>
                          setPartPricing((prev) =>
                            prev.map((row) =>
                              row.partKey === part.key
                                ? { ...row, price: event.target.value, isManual: true }
                                : row
                            )
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Qty</p>
                      <p className="font-medium">{quantity}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Unit price</p>
                      <p className="font-medium">{formatCurrency(unitPrice)}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Line total</p>
                      <p className="font-medium">{formatCurrency(lotTotal)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom amounts</CardTitle>
              <CardDescription>
                Add manual one-off quote amounts with a title. These flow into the final estimate and convert into order charges using the quote origin department.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customAmounts.length ? (
                customAmounts.map((item) => (
                  <div key={item.key} className="grid gap-3 rounded border border-border/60 bg-background/60 p-3 md:grid-cols-[1.4fr_180px_auto] md:items-end">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input
                        value={item.title}
                        onChange={(event) => updateCustomAmount(item.key, { title: event.target.value })}
                        placeholder="Rush setup"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Amount (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={(event) => updateCustomAmount(item.key, { amount: event.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeCustomAmount(item.key)}>
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded border border-dashed border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                  No manual custom amounts added.
                </div>
              )}
              <Button type="button" variant="outline" onClick={addCustomAmount}>
                Add custom amount
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
              <div className="flex items-center justify-between text-sm">
                <span>Part pricing (basis-adjusted)</span>
                <span className="font-medium">{formatCurrency(partPricingTotalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Custom amounts</span>
                <span className="font-medium">{formatCurrency(customAmountsTotalCents)}</span>
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
  );
}
