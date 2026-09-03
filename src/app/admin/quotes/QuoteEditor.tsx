'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { QuoteWizardProgress } from './QuoteWizardProgress';
import { QuotePartEntryChooser } from './QuotePartEntryChooser';
import { QuoteManualPartsPanel } from './QuoteManualPartsPanel';
import type { NewQuoteCustomerInput } from './NewQuoteCustomerDialog';
import { QuoteCustomIntakeFieldsCard } from './QuoteCustomIntakeFieldsCard';
import { QuoteGeneralInformationCard } from './QuoteGeneralInformationCard';
import { QuoteAttachmentsCard, type QuoteAttachmentItem } from './QuoteAttachmentsCard';
import { QuoteBuildDetailsCards } from './QuoteBuildDetailsCards';
import { QuoteCustomAmountsCard } from './QuoteCustomAmountsCard';
import { QuoteDrawingEntryPanel } from './QuoteDrawingEntryPanel';
import { QuoteMaterialCheckPanel } from './QuoteMaterialCheckPanel';
import { QuoteRoutingCard } from './QuoteRoutingCard';
import { QuoteTotalsSummaryCard } from './QuoteTotalsSummaryCard';
import { QuotePurchasedItemsCard } from './QuotePurchasedItemsCard';

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
  Card,
  CardContent,
  CardDescription,
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
import type { CustomFieldDefinition } from '@/components/CustomFieldInputs';
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
  normalizeWorkItemRateType,
  type WorkItemRateType,
} from '@/modules/pricing/work-item-pricing';
import {
  calculatePartLotTotal,
  calculatePartUnitPrice,
  calculateProcurementTotalCents,
  calculateSuggestedPartUnitPriceCents,
  type PartPricingMode,
} from '@/modules/pricing/part-pricing';
import {
  buildPresetFromSelections,
  dedupePresetItems,
  mergeSelectionsWithoutDuplicates,
  type QuoteAddonPreset,
  type QuoteAddonPresetItem,
} from '@/modules/quotes/quote-addon-bulk';
import {
  getActiveQuoteDepartments,
  getNewQuoteOriginDepartmentId,
} from '@/modules/quotes/quote-departments';
import { sumQuoteCustomAmountsCents, type QuoteCustomAmountEntry } from '@/lib/quote-metadata';
import type { ReviewedDrawingPart } from '@/components/orders/DrawingImportPanel';
import {
  createQuoteDrawingImportV2ApiClient,
  type DrawingImportReviewFile,
  type ResolveDrawingImportEvidenceUrls,
  type ReviewedQuoteDrawingPartV2,
} from '@/components/orders/drawing-import';
import { clearDrawingImportDraft } from '@/modules/drawing-import/drawing-import.draft';
import { clearIntakeDraft, intakeDraftKey, readIntakeDraft, writeIntakeDraft } from '@/modules/intake-drafts/intake-draft';
import { CustomerPartPicker } from '@/components/customer-parts/CustomerPartPicker';
import { CustomerPartNoteSuggestions, appendSuggestedNote } from '@/components/customer-parts/CustomerPartNoteSuggestions';
import type { CustomerPartNoteSuggestion, CustomerPartReusableDraft } from '@/modules/customer-parts/customer-parts.types';

import type { QuoteCreateInput } from '@/modules/quotes/quotes.schema';
import {
  createIntakeKey as createKey,
  numberFromIntakeDraft as numberFromString,
  type IntakeCustomerOption,
} from '@/modules/order-intake/order-intake.client';

type Option = IntakeCustomerOption;

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
  persistedId?: string;
  name: string;
  partNumber: string;
  materialId: string;
  drawingMaterialText: string;
  drawingFinishText: string;
  finish: string;
  stockSize: string;
  cutLength: string;
  finalPartLength: string;
  partWidth: string;
  partThickness: string;
  drawingImportPageId?: string;
  materialStatus: 'UNREVIEWED' | 'IN_STOCK' | 'NEED_TO_ORDER' | 'NOT_REQUIRED';
  inventoryLocation: string;
  materialNotes: string;
  procurementVendorId: string;
  procurementCost: string;
  procurementMarkupPercent: string;
  description: string;
  quantity: string;
  pieceCount: string;
  notes: string;
  workInstructions: string;
  noteSuggestions?: CustomerPartNoteSuggestion[];
  addonSelections: QuoteAddonState[];
  attachments: Array<{
    id?: string;
    kind: 'DWG' | 'STEP' | 'PDF' | 'PRINT' | 'IMAGE' | 'OTHER';
    url: string;
    storagePath: string;
    label: string;
    mimeType: string;
  }>;
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
  nameSnapshot?: string;
  rateTypeSnapshot?: WorkItemRateType;
  rateCentsSnapshot?: number;
  affectsPriceSnapshot?: boolean;
  isChecklistItemSnapshot?: boolean;
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
  priceSource: 'CALCULATED' | 'MANUAL';
  suggestedUnitPriceCents: number;
};

type AttachmentState = QuoteAttachmentItem;

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  business: BusinessCode;
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  customerId?: string | null;
  customerContactId?: string | null;
  status: string;
  workflowStep?: number;
  updatedAt?: string;
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
    finalPartLength?: string | null;
    drawingImportPageId?: string | null;
    partWidth?: string | null;
    partThickness?: string | null;
    drawingMaterialText?: string | null;
    drawingFinishText?: string | null;
    finish?: string | null;
    materialStatus?: 'UNREVIEWED' | 'IN_STOCK' | 'NEED_TO_ORDER' | 'NOT_REQUIRED';
    inventoryLocation?: string | null;
    materialNotes?: string | null;
    procurementVendorId?: string | null;
    procurementCostCents?: number | null;
    procurementMarkupPercent?: number | null;
    sortOrder?: number;
    description?: string | null;
    quantity: number;
    pieceCount: number;
    notes?: string | null;
    workInstructions?: string | null;
    attachments?: Array<{
      id: string;
      kind: 'DWG' | 'STEP' | 'PDF' | 'PRINT' | 'IMAGE' | 'OTHER';
      url?: string | null;
      storagePath?: string | null;
      label?: string | null;
      mimeType?: string | null;
    }>;
    addonSelections?: Array<{
      id: string;
      quotePartId?: string | null;
      addonId: string;
      units: number;
      rateTypeSnapshot: string;
      rateCents: number;
      totalCents: number;
      nameSnapshot?: string | null;
      affectsPriceSnapshot?: boolean;
      isChecklistItemSnapshot?: boolean;
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
    nameSnapshot?: string | null;
    affectsPriceSnapshot?: boolean;
    isChecklistItemSnapshot?: boolean;
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
      quotePartId?: string | null;
      name?: string | null;
      partNumber?: string | null;
      priceCents: number;
      pricingMode?: PartPricingMode;
      priceSource?: 'CALCULATED' | 'MANUAL';
      suggestedUnitPriceCents?: number;
    }>;
    customAmounts?: QuoteCustomAmountEntry[];
  } | null;
};

interface QuoteEditorProps {
  mode: 'create' | 'edit';
  initialQuote?: QuoteDetail;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const centsFromString = (value: string) => {
  const parsed = Number.parseFloat(value || '0');
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
};

export default function QuoteEditor({ mode, initialQuote }: QuoteEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const drawingImportV2Api = useMemo(() => createQuoteDrawingImportV2ApiClient(), []);
  const [useLegacyDrawingImporter, setUseLegacyDrawingImporter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [departmentsLoadFailed, setDepartmentsLoadFailed] = useState(false);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  const initialBusinessCode = (initialQuote?.business ?? BUSINESS_OPTIONS[0]?.code ?? 'STD') as BusinessCode;

  const [form, setForm] = useState({
    business: initialBusinessCode,
    quoteNumber: initialQuote?.quoteNumber ?? '',
    companyName: initialQuote?.companyName ?? '',
    contactName: initialQuote?.contactName ?? '',
    contactEmail: initialQuote?.contactEmail ?? '',
    contactPhone: initialQuote?.contactPhone ?? '',
    customerId: initialQuote?.customerId ?? '',
    customerContactId: initialQuote?.customerContactId ?? '',
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
        drawingMaterialText: '',
        drawingFinishText: '',
        finish: '',
        stockSize: '',
        cutLength: '',
        finalPartLength: '',
        partWidth: '',
        partThickness: '',
        materialStatus: 'UNREVIEWED',
        inventoryLocation: '',
        materialNotes: '',
        procurementVendorId: '',
        procurementCost: '',
        procurementMarkupPercent: '20',
        description: '',
        quantity: '1',
        pieceCount: '1',
        notes: '',
        workInstructions: '',
        addonSelections: [],
        attachments: [],
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
              persistedId: part.id,
              name: part.name,
              partNumber: part.partNumber ?? '',
              materialId: part.materialId ?? '',
              drawingMaterialText: part.drawingMaterialText ?? '',
              drawingFinishText: part.drawingFinishText ?? '',
              finish: part.finish ?? '',
              stockSize: part.stockSize ?? '',
              cutLength: part.cutLength ?? '',
              finalPartLength: part.finalPartLength ?? '',
              partWidth: part.partWidth ?? '',
              partThickness: part.partThickness ?? '',
              drawingImportPageId: part.drawingImportPageId ?? undefined,
              materialStatus: part.materialStatus ?? 'UNREVIEWED',
              inventoryLocation: part.inventoryLocation ?? '',
              materialNotes: part.materialNotes ?? '',
              procurementVendorId: part.procurementVendorId ?? '',
              procurementCost: part.procurementCostCents ? (part.procurementCostCents / 100).toFixed(2) : '',
              procurementMarkupPercent: String(part.procurementMarkupPercent ?? 20),
              description: part.description ?? '',
              quantity: String(part.quantity ?? 1),
              pieceCount: String(part.pieceCount ?? 1),
              notes: part.notes ?? '',
              workInstructions: part.workInstructions ?? '',
              attachments: (part.attachments ?? []).map((attachment) => ({
                id: attachment.id,
                kind: attachment.kind,
                url: attachment.url ?? '',
                storagePath: attachment.storagePath ?? '',
                label: attachment.label ?? '',
                mimeType: attachment.mimeType ?? '',
              })),
              addonSelections: selections.map((selection) => ({
                key: selection.id,
                addonId: selection.addonId,
                units: String(selection.units ?? 0),
                notes: selection.notes ?? '',
                nameSnapshot: selection.nameSnapshot ?? selection.addon?.name ?? undefined,
                rateTypeSnapshot: normalizeWorkItemRateType(selection.rateTypeSnapshot),
                rateCentsSnapshot: selection.rateCents,
                affectsPriceSnapshot: selection.affectsPriceSnapshot,
                isChecklistItemSnapshot: selection.isChecklistItemSnapshot,
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
      persistedId: attachment.id,
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
  const [currentStep, setCurrentStep] = useState(() => Math.min(4, Math.max(0, initialQuote?.workflowStep ?? 0)));
  const [furthestStep, setFurthestStep] = useState(() => Math.min(4, Math.max(0, initialQuote?.workflowStep ?? 0)));
  const [savedAt, setSavedAt] = useState<string | null>(initialQuote?.updatedAt ?? null);
  const [partEntryMode, setPartEntryMode] = useState<'manual' | 'drawing' | 'existing' | null>(() =>
    (initialQuote?.parts?.length ?? 0) > 0 ? 'manual' : null
  );

  const [partPricing, setPartPricing] = useState<PartPricingState[]>(() => {
    const initialPartPricing = getPartPricingEntries({
      parts: (initialQuote?.parts ?? []).map((part) => ({
        id: part.id,
        name: part.name,
        partNumber: part.partNumber ?? null,
        quantity: part.quantity,
        addonSelections: (part.addonSelections ?? []).map((selection) => ({ totalCents: selection.totalCents ?? 0 })),
      })),
      metadata: initialQuote?.metadata,
    });
    return parts.map((part, index) => {
      const entry = initialPartPricing[index];
      const isManual = entry?.priceSource === 'MANUAL';
      const enteredPriceCents = isManual
        ? entry?.priceCents ?? 0
        : entry?.suggestedUnitPriceCents ?? entry?.priceCents ?? 0;
      return {
        partKey: part.key,
        price: (enteredPriceCents / 100).toFixed(2),
        pricingMode: isManual && entry?.pricingMode === 'LOT_TOTAL' ? 'LOT_TOTAL' : 'PER_UNIT',
        priceSource: isManual ? 'MANUAL' : 'CALCULATED',
        suggestedUnitPriceCents: entry?.suggestedUnitPriceCents ?? enteredPriceCents,
      } satisfies PartPricingState;
    });
  });
  const [expandedPartPricingKeys, setExpandedPartPricingKeys] = useState<Set<string>>(() => new Set());
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
    { key: 'customer', label: 'Customer' },
    { key: 'parts', label: 'Drawings & parts' },
    { key: 'material', label: 'Material check' },
    { key: 'build', label: 'Work details' },
    { key: 'review', label: 'Pricing & finish' },
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
    fetch(`/api/custom-fields?entityType=QUOTE&businessCode=${form.business}&isActive=true`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const nextFields = data.items ?? [];
        setCustomFields(nextFields);
        setCustomFieldValues((prev) => {
          const next: Record<string, unknown> = {};
          nextFields.forEach((field: CustomFieldDefinition) => {
            if (prev[field.id] !== undefined) next[field.id] = prev[field.id];
            else if (field.defaultValue !== undefined) next[field.id] = field.defaultValue;
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
      return parts.map((part) => {
        const existing = byPartKey.get(part.key);
        const workStepsLineCents = part.addonSelections.reduce((sum, selection) => {
          const current = addons.find((addon) => addon.id === selection.addonId);
          return sum + calculateAssignmentTotalCents({
            item: {
              rateType: selection.rateTypeSnapshot ?? current?.rateType,
              rateCents: selection.rateCentsSnapshot ?? current?.rateCents ?? 0,
              affectsPrice: selection.affectsPriceSnapshot ?? current?.affectsPrice ?? true,
            },
            units: numberFromString(selection.units),
          });
        }, 0);
        const quantity = Math.max(1, Number.parseInt(part.quantity || '1', 10) || 1);
        const procurementTotalCents = part.materialStatus === 'NEED_TO_ORDER'
          ? calculateProcurementTotalCents({
              baseCostCents: centsFromString(part.procurementCost),
              markupPercent: Number.parseFloat(part.procurementMarkupPercent || '0'),
            })
          : 0;
        const suggestedUnitPriceCents = calculateSuggestedPartUnitPriceCents({
          workItemsSubtotalCents: workStepsLineCents,
          procurementTotalCents,
          quantity,
        });
        const autoPrice = (suggestedUnitPriceCents / 100).toFixed(2);

        if (!existing) {
          return {
            partKey: part.key,
            price: autoPrice,
            pricingMode: 'PER_UNIT' as PartPricingMode,
            priceSource: 'CALCULATED' as const,
            suggestedUnitPriceCents,
          };
        }

        return existing.priceSource === 'MANUAL'
          ? { ...existing, suggestedUnitPriceCents }
          : { ...existing, price: autoPrice, pricingMode: 'PER_UNIT', suggestedUnitPriceCents };
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

  const [draftReference, setDraftReference] = useState(() => createKey());
  const quoteDraftStorageKey = useMemo(() => intakeDraftKey('quote'), []);
  const [quoteDraftReady, setQuoteDraftReady] = useState(false);
  const [quoteDraftSavedAt, setQuoteDraftSavedAt] = useState<number | null>(null);
  const suppressQuoteDraft = React.useRef(false);

  useEffect(() => {
    if (mode !== 'create') { setQuoteDraftReady(true); return; }
    const saved = readIntakeDraft<any>(window.localStorage, quoteDraftStorageKey);
    if (saved?.data && typeof saved.data === 'object') {
      const draft = saved.data;
      if (typeof draft.draftReference === 'string' && draft.draftReference) setDraftReference(draft.draftReference);
      if (draft.form && typeof draft.form === 'object') setForm((current) => ({ ...current, ...draft.form, quoteNumber: '' }));
      if (Array.isArray(draft.parts) && draft.parts.length) setParts(draft.parts);
      if (typeof draft.activePartKey === 'string') setActivePartKey(draft.activePartKey);
      if (Array.isArray(draft.vendorItems)) setVendorItems(draft.vendorItems);
      if (Array.isArray(draft.attachments)) setAttachments(draft.attachments.map((attachment: AttachmentState) => ({ ...attachment, uploading: false, persistedId: undefined })));
      if (typeof draft.attachmentBusiness === 'string') setAttachmentBusiness(draft.attachmentBusiness);
      if (draft.customFieldValues && typeof draft.customFieldValues === 'object') setCustomFieldValues(draft.customFieldValues);
      if (Number.isInteger(draft.currentStep)) setCurrentStep(Math.max(0, Math.min(4, draft.currentStep)));
      if (Number.isInteger(draft.furthestStep)) setFurthestStep(Math.max(0, Math.min(4, draft.furthestStep)));
      if (draft.partEntryMode === 'manual' || draft.partEntryMode === 'drawing' || draft.partEntryMode === 'existing') setPartEntryMode(draft.partEntryMode);
      if (Array.isArray(draft.partPricing)) setPartPricing(draft.partPricing);
      if (typeof draft.originDepartmentId === 'string') setOriginDepartmentId(draft.originDepartmentId);
      if (Array.isArray(draft.customAmounts)) setCustomAmounts(draft.customAmounts);
      setQuoteDraftSavedAt(saved.updatedAt);
    }
    setQuoteDraftReady(true);
  // Restore once before autosave begins.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, quoteDraftStorageKey]);

  useEffect(() => {
    if (mode !== 'create' || !quoteDraftReady || suppressQuoteDraft.current) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = writeIntakeDraft(window.localStorage, quoteDraftStorageKey, {
          draftReference, form: { ...form, quoteNumber: '' }, parts: parts.map((part) => ({ ...part, persistedId: undefined })),
          activePartKey, vendorItems, attachments: attachments.map((attachment) => ({ ...attachment, uploading: false, persistedId: undefined })),
          attachmentBusiness, customFieldValues, currentStep, furthestStep, partEntryMode, partPricing, originDepartmentId, customAmounts,
        });
        setQuoteDraftSavedAt(savedAt);
      } catch { /* Browser storage can be unavailable; manual/server save still works. */ }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activePartKey, attachmentBusiness, attachments, currentStep, customAmounts, customFieldValues, draftReference, form, furthestStep, mode, originDepartmentId, partEntryMode, partPricing, parts, quoteDraftReady, quoteDraftStorageKey, vendorItems]);

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
      .then((data) => {
        setDepartments(Array.isArray(data?.items) ? data.items : []);
        setDepartmentsLoadFailed(false);
      })
      .catch(() => {
        setDepartments([]);
        setDepartmentsLoadFailed(true);
      })
      .finally(() => setDepartmentsLoaded(true));

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

    fetch('/api/admin/customers?take=5000', { credentials: 'include' })
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
            contacts: Array.isArray(item.contacts) ? item.contacts : [],
          })),
        );
      })
      .catch(() => setCustomers([]));
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    if (!customerId) return;
    const selected = customers.find((customer) => customer.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      companyName: selected?.name ?? prev.companyName,
      customerContactId: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
    }));
  };

  const handleCustomerContactSelect = (contactId: string) => {
    const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
    const selectedContact = selectedCustomer?.contacts?.find((contact) => contact.id === contactId);
    setForm((prev) => ({
      ...prev,
      customerContactId: selectedContact?.id ?? '',
      contactName: selectedContact?.name ?? '',
      contactEmail: selectedContact?.email ?? '',
      contactPhone: selectedContact?.phone ?? '',
    }));
  };

  async function createCustomer(payload: NewQuoteCustomerInput) {
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
        contacts: Array.isArray(data.item.contacts) ? data.item.contacts : [],
      };
      setCustomers((s) => [newCustomer, ...s]);
      const primaryContact = newCustomer.contacts?.find((contact) => contact.isPrimary) ?? newCustomer.contacts?.[0];
      setForm((current) => ({
        ...current,
        customerId: newCustomer.id,
        companyName: newCustomer.name,
        customerContactId: primaryContact?.id ?? '',
        contactName: primaryContact?.name ?? newCustomer.contact ?? '',
        contactEmail: primaryContact?.email ?? newCustomer.email ?? '',
        contactPhone: primaryContact?.phone ?? newCustomer.phone ?? '',
      }));
      return true;
    }
    return false;
  }

  function addPart() {
    setParts((prev) => [...prev, buildEmptyPart()]);
  }

  function useImportedDrawings(importedParts: ReviewedDrawingPart[], quoteFiles: ReviewedDrawingPart['source'][]) {
    const nextParts: QuotePartState[] = importedParts.map((part, index) => ({
      key: part.key,
      name: part.partName || part.partNumber || `Part ${index + 1}`,
      partNumber: part.partNumber,
      materialId: part.materialId,
      drawingMaterialText: part.drawingMaterialText,
      drawingFinishText: part.drawingFinishText,
      finish: part.finish,
      stockSize: part.stockSize,
      cutLength: part.cutLength,
      finalPartLength: part.finalPartLength,
      partWidth: part.partWidth,
      partThickness: part.partThickness,
      materialStatus: 'UNREVIEWED',
      inventoryLocation: '',
      materialNotes: '',
      procurementVendorId: '',
      procurementCost: '',
      procurementMarkupPercent: '20',
      description: '',
      quantity: String(part.quantity || 1),
      pieceCount: '1',
      notes: part.finish ? `Finish: ${part.finish}` : '',
      workInstructions: '',
      noteSuggestions: [],
      addonSelections: [],
      attachments: [{
        kind: 'DWG',
        url: '',
        storagePath: part.source.storagePath,
        label: part.source.label,
        mimeType: part.source.mimeType,
      }],
    }));
    setParts(nextParts);
    setActivePartKey(nextParts[0]?.key ?? createKey());
    setAttachments((current) => [
      ...current,
      ...quoteFiles.map((file) => ({
        key: createKey(),
        url: '',
        storagePath: file.storagePath,
        label: file.label,
        mimeType: file.mimeType,
        isPrintForBom: false,
        uploading: false,
      })),
    ]);
    setPartEntryMode('manual');
    toast.push(`${nextParts.length} drawing part${nextParts.length === 1 ? '' : 's'} added to this quote.`, 'success');
  }

  function applyImportedDrawingsV2(importedParts: ReviewedQuoteDrawingPartV2[], quoteFiles: DrawingImportReviewFile[]) {
    const nextParts: QuotePartState[] = importedParts.map((part, index) => ({
      key: part.key,
      drawingImportPageId: part.importPageId,
      name: part.partName || part.partNumber || `Part ${index + 1}`,
      partNumber: part.partNumber,
      materialId: part.materialId,
      drawingMaterialText: part.drawingMaterialText,
      drawingFinishText: part.drawingFinishText,
      finish: part.finish,
      stockSize: part.stockSize,
      cutLength: part.cutLength,
      finalPartLength: part.finalPartLength,
      partWidth: part.partWidth,
      partThickness: part.partThickness,
      materialStatus: 'UNREVIEWED',
      inventoryLocation: '',
      materialNotes: '',
      procurementVendorId: '',
      procurementCost: '',
      procurementMarkupPercent: '20',
      description: '',
      quantity: String(part.quantity || 1),
      pieceCount: '1',
      notes: [part.finish ? `Finish: ${part.finish}` : '', part.revision ? `Revision: ${part.revision}` : ''].filter(Boolean).join('\n'),
      workInstructions: '',
      noteSuggestions: part.noteSuggestions,
      addonSelections: [],
      attachments: [{
        kind: 'DWG',
        url: '',
        storagePath: part.source.storagePath,
        label: part.source.label,
        mimeType: part.source.mimeType,
      }],
    }));
    setParts(nextParts);
    setActivePartKey(nextParts[0]?.key ?? createKey());
    setAttachments((current) => [
      ...current,
      ...quoteFiles.map((file) => ({
        key: createKey(),
        url: '',
        storagePath: file.storagePath,
        label: file.label,
        mimeType: file.mimeType,
        isPrintForBom: false,
        uploading: false,
      })),
    ]);
    setPartEntryMode('manual');
    toast.push(`${nextParts.length} evidence-backed drawing part${nextParts.length === 1 ? '' : 's'} added to this quote.`, 'success');
  }

  function addPreexistingQuoteParts(drafts: CustomerPartReusableDraft[]) {
    const nextParts: QuotePartState[] = drafts.map((draft) => ({
      key: draft.key,
      name: draft.partName || draft.partNumber,
      partNumber: draft.partNumber,
      materialId: draft.materialId,
      drawingMaterialText: draft.drawingMaterialText,
      drawingFinishText: draft.drawingFinishText,
      finish: draft.finish,
      stockSize: draft.stockSize,
      cutLength: draft.cutLength,
      finalPartLength: draft.finalPartLength,
      partWidth: draft.partWidth,
      partThickness: draft.partThickness,
      drawingImportPageId: draft.drawingImportPageId,
      materialStatus: 'UNREVIEWED',
      inventoryLocation: '',
      materialNotes: '',
      procurementVendorId: '',
      procurementCost: '',
      procurementMarkupPercent: '20',
      description: '',
      quantity: '1',
      pieceCount: '1',
      notes: '',
      workInstructions: '',
      noteSuggestions: draft.noteSuggestions,
      addonSelections: [],
      attachments: draft.attachments
        .filter((attachment) => Boolean(attachment.storagePath || attachment.url))
        .map((attachment) => ({
          kind: attachment.kind,
          url: attachment.url ?? '',
          storagePath: attachment.storagePath ?? '',
          label: attachment.label ?? '',
          mimeType: attachment.mimeType ?? '',
        })),
    }));
    if (!nextParts.length) return;
    setParts((current) => {
      const retained = current.filter((part) => part.name.trim() || part.partNumber.trim() || part.attachments.length);
      return [...retained, ...nextParts];
    });
    setActivePartKey(nextParts[0].key);
    setPartEntryMode('manual');
    toast.push(`${nextParts.length} preexisting customer part${nextParts.length === 1 ? '' : 's'} added for review.`, 'success');
  }

  const resolveDrawingImportEvidenceUrls = React.useCallback<ResolveDrawingImportEvidenceUrls>((page, evidence) => {
    const cropUrl = evidence.sourceCropId && page.exactPageHref
      ? `${page.exactPageHref.replace(/\?kind=canonical$/, '')}?kind=crop&path=${encodeURIComponent(evidence.sourceCropId)}`
      : null;
    return { previewUrl: page.previewUrl, cropUrl, exactPageHref: page.exactPageHref };
  }, []);

  async function createDetectedMaterial(name: string) {
    const response = await fetch('/api/admin/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), active: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not create material.');
    const material = { id: String(payload.item.id), name: String(payload.item.name) };
    setMaterials((current) => [...new Map([...current, material].map((entry) => [entry.id, entry])).values()]);
    return material;
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
    const selectedAddon = addons.find((addon) => addon.id === addonId);
    const targetPart = parts.find((part) => part.key === partKey);
    if (addonId && targetPart?.addonSelections.some((selection) => selection.addonId === addonId)) {
      toast.push('That work step is already on this part.', 'info');
      return;
    }
    setParts((prev) =>
      prev.map((part) =>
        part.key === partKey
          ? {
              ...part,
              addonSelections: [
                ...part.addonSelections,
                {
                  key: createKey(),
                  addonId,
                  units: '1.0',
                  notes: '',
                  rateTypeSnapshot: selectedAddon?.rateType,
                  rateCentsSnapshot: selectedAddon?.rateCents,
                  affectsPriceSnapshot: selectedAddon?.affectsPrice,
                  isChecklistItemSnapshot: selectedAddon?.isChecklistItem,
                },
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
  const activeDepartments = useMemo(
    () => getActiveQuoteDepartments(departments),
    [departments]
  );

  useEffect(() => {
    if (mode !== 'create' || !departmentsLoaded) return;
    setOriginDepartmentId((current) => getNewQuoteOriginDepartmentId(current, departments));
  }, [departments, departmentsLoaded, mode]);
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
      const rawWorkItemsSubtotalCents = part.addonSelections.reduce((sum, selection) => {
        const current = addonMap.get(selection.addonId);
        return sum + calculateAssignmentTotalCents({
          item: {
            rateType: selection.rateTypeSnapshot ?? current?.rateType,
            rateCents: selection.rateCentsSnapshot ?? current?.rateCents ?? 0,
            affectsPrice: selection.affectsPriceSnapshot ?? current?.affectsPrice ?? true,
          },
          units: numberFromString(selection.units),
        });
      }, 0);
      const entry = partPricing.find((candidate) => candidate.partKey === part.key);
      const enteredPriceCents = centsFromString(entry?.price || '0');
      const quantity = Number.parseInt(part.quantity || '1', 10) || 1;
      const procurementTotalCents = part.materialStatus === 'NEED_TO_ORDER'
        ? calculateProcurementTotalCents({
            baseCostCents: centsFromString(part.procurementCost),
            markupPercent: Number.parseFloat(part.procurementMarkupPercent || '0'),
          })
        : 0;
      const suggestedUnitPriceCents = calculateSuggestedPartUnitPriceCents({
        workItemsSubtotalCents: rawWorkItemsSubtotalCents,
        procurementTotalCents,
        quantity,
      });

      return {
        workItemsSubtotalCents: rawWorkItemsSubtotalCents,
        partPricingSubtotalCents:
          entry?.priceSource === 'MANUAL'
            ? calculatePartLotTotal({
                enteredPriceCents,
                quantity,
                pricingMode: entry.pricingMode,
              })
            : suggestedUnitPriceCents * Math.max(1, quantity),
        hasPartPricingOverride: true,
      };
    }),
  });
  const addonsTotalsCents = pricingSummaryTotals.addonsAndLaborCents;
  const partPricingTotalCents = pricingSummaryTotals.partPricingCents;
  const customAmountsTotalCents = sumQuoteCustomAmountsCents(normalizedCustomAmounts);
  const totalCents =
    basePriceCents + vendorTotalsCents + addonsTotalsCents + partPricingTotalCents + customAmountsTotalCents;

  const buildPayload = (workflowStep = currentStep): QuoteCreateInput => ({
    business: form.business,
    quoteNumber: form.quoteNumber || undefined,
    companyName: form.companyName,
    contactName: form.contactName || undefined,
    contactEmail: form.contactEmail || undefined,
    contactPhone: form.contactPhone || undefined,
    customerId: form.customerId || undefined,
    customerContactId: form.customerContactId || undefined,
    status: form.status || 'DRAFT',
    workflowStep,
    materialSummary: form.materialSummary || undefined,
    purchaseItems: form.purchaseItems || undefined,
    requirements: form.requirements || undefined,
    notes: form.notes || undefined,
    basePriceCents,
    multiPiece: form.multiPiece || parts.some((part) => (Number.parseInt(part.pieceCount || '1', 10) || 1) > 1),
    parts: parts
      .filter((part) => part.name.trim())
      .map((part, index) => ({
        id: part.persistedId,
        name: part.name,
        partNumber: part.partNumber || undefined,
        materialId: part.materialId || undefined,
        drawingMaterialText: part.drawingMaterialText || undefined,
        drawingFinishText: part.drawingFinishText || undefined,
        finish: part.finish || undefined,
        stockSize: part.stockSize || undefined,
        cutLength: part.cutLength || undefined,
        finalPartLength: part.finalPartLength || undefined,
        partWidth: part.partWidth || undefined,
        partThickness: part.partThickness || undefined,
        drawingImportPageId: part.drawingImportPageId || undefined,
        materialStatus: part.materialStatus,
        inventoryLocation: part.inventoryLocation || undefined,
        materialNotes: part.materialNotes || undefined,
        procurementVendorId: part.procurementVendorId || undefined,
        procurementCostCents: part.procurementCost.trim() ? centsFromString(part.procurementCost) : undefined,
        procurementMarkupPercent: part.procurementMarkupPercent.trim()
          ? Number.parseFloat(part.procurementMarkupPercent) || 0
          : undefined,
        sortOrder: index,
        description: part.description || undefined,
        quantity: Number.parseInt(part.quantity || '1', 10) || 1,
        pieceCount: Number.parseInt(part.pieceCount || '1', 10) || 1,
        notes: part.notes || undefined,
        workInstructions: part.workInstructions || undefined,
        attachments: part.attachments
          .filter((attachment) => attachment.url.trim() || attachment.storagePath.trim())
          .map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind,
            url: attachment.url.trim() || undefined,
            storagePath: attachment.storagePath.trim() || undefined,
            label: attachment.label.trim() || undefined,
            mimeType: attachment.mimeType.trim() || undefined,
          })),
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
        id: attachment.persistedId,
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
    partPricing: parts.filter((part) => part.name.trim()).map((part) => {
      const entry = partPricing.find((candidate) => candidate.partKey === part.key);
      return {
        quotePartId: part.persistedId,
        name: part.name || undefined,
        partNumber: part.partNumber || undefined,
        priceCents: centsFromString(entry?.price || '0'),
        pricingMode: entry?.priceSource === 'MANUAL' ? entry.pricingMode : 'PER_UNIT',
        priceSource: entry?.priceSource ?? 'CALCULATED',
        suggestedUnitPriceCents: entry?.suggestedUnitPriceCents ?? 0,
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

  function validateCheckpoint(step: number) {
    if (step === 0 && (!form.customerId || !form.companyName.trim())) {
      return 'Choose a customer before continuing.';
    }
    if (step === 1 && !parts.some((part) => part.name.trim() && part.partNumber.trim())) {
      return 'Add at least one part with a part name and part number before continuing.';
    }
    if (step === 2) {
      const realParts = parts.filter((part) => part.name.trim());
      const unreviewed = realParts.filter((part) => part.materialStatus === 'UNREVIEWED');
      if (unreviewed.length) return `Finish the material decision for ${unreviewed.length} part${unreviewed.length === 1 ? '' : 's'}.`;
      const missingVendor = realParts.filter(
        (part) => part.materialStatus === 'NEED_TO_ORDER' && !part.procurementVendorId,
      );
      if (missingVendor.length) return `Choose a vendor for ${missingVendor.length} part${missingVendor.length === 1 ? '' : 's'} that need material ordered.`;
    }
    return null;
  }

  function applySavedIdentity(item: QuoteDetail) {
    const savedParts = [...(item.parts ?? [])];
    setParts((current) => current.map((part) => {
      if (!part.name.trim()) return part;
      const matchIndex = savedParts.findIndex((saved) =>
        (part.persistedId && saved.id === part.persistedId) ||
        (!part.persistedId && saved.partNumber === part.partNumber && saved.name === part.name),
      );
      const match = matchIndex >= 0 ? savedParts.splice(matchIndex, 1)[0] : savedParts.shift();
      return match ? { ...part, persistedId: match.id } : part;
    }));
    const savedAttachments = [...(item.attachments ?? [])];
    setAttachments((current) => current.map((attachment) => {
      const match = savedAttachments.find((saved) =>
        (attachment.persistedId && saved.id === attachment.persistedId) ||
        (!attachment.persistedId && Boolean(attachment.storagePath) && saved.storagePath === attachment.storagePath),
      );
      return match ? { ...attachment, persistedId: match.id } : attachment;
    }));
  }

  const saveQuote = async ({ nextStep = currentStep, finish = false }: { nextStep?: number; finish?: boolean } = {}) => {
    if (mode === 'create' && !originDepartmentId) {
      setError(
        departmentsLoadFailed
          ? 'Departments could not be loaded. Refresh the page before saving this quote.'
          : departmentsLoaded
            ? 'Create an active department before saving this quote.'
            : 'Wait for the default department to finish loading before saving this quote.'
      );
      return false;
    }
    setLoading(true);
    setError(null);
    const payload = buildPayload(nextStep);
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

      applySavedIdentity(response.item);
      if (mode === 'create') {
        suppressQuoteDraft.current = true;
        clearIntakeDraft(window.localStorage, quoteDraftStorageKey);
        setQuoteDraftSavedAt(null);
      }
      clearDrawingImportDraft(window.localStorage, {
        destination: 'quote',
        business: getBusinessOptionByCode(form.business)?.name ?? BUSINESS_OPTIONS[0]?.name ?? 'Sterling Tool and Die',
        customerName: form.companyName,
      });
      setSavedAt(response.item.updatedAt ?? new Date().toISOString());
      setFurthestStep((current) => Math.max(current, nextStep));
      toast.push(finish ? 'Quote saved' : 'Progress saved', 'success');
      if (finish) {
        router.push(`/admin/quotes/${response.item.id}`);
      } else if (mode === 'create') {
        router.replace(`/admin/quotes/${response.item.id}/edit`);
      } else {
        setCurrentStep(nextStep);
      }
      return true;
    } catch (err: any) {
      setError(err?.body?.error || err.message || 'Failed to save quote');
      return false;
    } finally {
      setLoading(false);
    }
  };

  async function saveAndContinue() {
    const validationError = validateCheckpoint(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    await saveQuote({ nextStep: Math.min(currentStep + 1, steps.length - 1) });
  }

  async function printMaterialWalkdown() {
    if (!initialQuote?.id) {
      setError('Save the customer and parts first so the printout has a quote number.');
      return;
    }
    // Open during the click event; browsers block pop-ups created only after an async save.
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      setError('Your browser blocked the print window. Allow pop-ups for ShopApp and try again.');
      return;
    }
    printWindow.opener = null;
    printWindow.document.title = 'Preparing shop walkdown…';
    printWindow.document.body.textContent = 'Saving the quote and preparing the shop walkdown sheet…';
    const saved = await saveQuote({ nextStep: currentStep });
    if (saved) printWindow.location.replace(`/admin/quotes/${initialQuote.id}/material-check/print`);
    else printWindow.close();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingFields = customFields.filter(
      (field) => field.isRequired && !hasCustomFieldValue(customFieldValues[field.id])
    );
    if (missingFields.length) {
      setError(`Fill in required custom fields: ${missingFields.map((field) => field.name).join(', ')}.`);
      return;
    }
    const validationError = [0, 1, 2]
      .slice(0, Math.min(currentStep, 2) + 1)
      .map((step) => validateCheckpoint(step))
      .find((message): message is string => Boolean(message));
    if (validationError) {
      setError(validationError);
      return;
    }
    await saveQuote({ nextStep: currentStep, finish: true });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <QuoteWizardProgress
        steps={steps}
        currentStep={currentStep}
        furthestStep={furthestStep}
        loading={loading}
        savedAt={savedAt}
        autosavedAt={quoteDraftSavedAt}
        canDiscardAutosave={mode === 'create' && Boolean(quoteDraftSavedAt)}
        canSave={Boolean(form.companyName.trim() && form.customerId)}
        onSelectStep={(index) => { if (index <= furthestStep) setCurrentStep(index); }}
        onSave={() => void saveQuote()}
        onDiscardAutosave={() => { clearIntakeDraft(window.localStorage, quoteDraftStorageKey); window.location.reload(); }}
      />

      {currentStep === 0 && (
        <>
          <QuoteGeneralInformationCard
            value={form}
            customers={customers}
            customerDialogOpen={customerDialogOpen}
            onBusinessChange={(business) => setForm((prev) => ({ ...prev, business }))}
            onCustomerSelect={handleCustomerSelect}
            onCustomerDialogOpenChange={setCustomerDialogOpen}
            onCreateCustomer={createCustomer}
            onCustomerContactSelect={handleCustomerContactSelect}
            onCustomerSaved={(updatedCustomer, newContactId) => {
              setCustomers((current) => current.map((customer) => (
                customer.id === updatedCustomer.id ? { ...customer, ...updatedCustomer } : customer
              )));
              handleCustomerContactSelect(newContactId);
            }}
            onContactChange={(patch) => setForm((previous) => ({ ...previous, ...patch }))}
          />
          <QuoteCustomIntakeFieldsCard
            fields={intakeCustomFields}
            values={customFieldValues}
            onChange={(fieldId, value) => setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))}
          />
        </>
      )}

      {currentStep === 1 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>How would you like to add the parts?</CardTitle>
            <CardDescription>Read new drawings, reuse a proven customer part, or enter the list yourself.</CardDescription>
            </CardHeader>
            <CardContent>
              <QuotePartEntryChooser value={partEntryMode} existingDescription="Search every saved part, regardless of customer or business." onChange={(nextMode) => { if (nextMode === 'drawing') setUseLegacyDrawingImporter(false); setPartEntryMode(nextMode); }} />
            </CardContent>
          </Card>

          {partEntryMode === 'drawing' ? (
            <QuoteDrawingEntryPanel
              useLegacyImporter={useLegacyDrawingImporter}
              api={drawingImportV2Api}
              business={getBusinessOptionByCode(form.business)?.name ?? BUSINESS_OPTIONS[0]?.name ?? 'Sterling Tool and Die'}
              customerName={form.companyName}
              draftReference={form.quoteNumber || initialQuote?.quoteNumber || draftReference}
              materials={materials}
              onContinueV2={(importedParts, quoteFiles) => applyImportedDrawingsV2(importedParts, quoteFiles)}
              onContinueLegacy={useImportedDrawings}
              onSwitchToLegacy={() => setUseLegacyDrawingImporter(true)}
              onSwitchToManual={() => setPartEntryMode('manual')}
              onCreateMaterial={createDetectedMaterial}
              resolveEvidenceUrls={resolveDrawingImportEvidenceUrls}
            />
          ) : partEntryMode === 'existing' ? (
            <CustomerPartPicker
              customerId={form.customerId}
              business={form.business}
              onAddParts={addPreexistingQuoteParts}
            />
          ) : partEntryMode === 'manual' ? (
            <QuoteManualPartsPanel
              parts={parts}
              activePartKey={activePartKey}
              materials={materials}
              onAddPart={() => {
                const nextPart = buildEmptyPart();
                setParts((previous) => [...previous, nextPart]);
                setActivePartKey(nextPart.key);
              }}
              onSelectPart={setActivePartKey}
              onRemovePart={removePart}
              onUpdatePart={updatePart}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">Choose one of the two large options above to continue.</CardContent>
            </Card>
          )}
        </>
      )}

      {currentStep === 2 && (
        <QuoteMaterialCheckPanel
          parts={parts}
          materials={materials}
          vendors={vendors}
          loading={loading}
          canPrint={Boolean(initialQuote?.id)}
          onPrint={() => void printMaterialWalkdown()}
          onUpdate={(partKey, patch) => updatePart(partKey, patch)}
        />
      )}

      {currentStep === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Work plan</CardTitle>
              <CardDescription>Add the work steps, instructions, and files needed for each part.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <AvailableItemsLibrary
                  title="Available work steps"
                  description="Click Add to put a step on the selected part."
                  items={availableItems}
                  onAddItem={(item) => {
                    if (!activePart) return;
                    addAddonSelection(activePart.key, item.id);
                  }}
                />
                {addons.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Need another step? Configure it in{' '}
                    <Link href="/admin/addons" className="underline">
                      Work Steps
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
                      <p className="text-xs text-muted-foreground">Select a part to build its work plan.</p>
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
                      <div className="mt-4 grid gap-2 rounded-lg border border-amber-500/35 bg-amber-500/5 p-4">
                        <div className="space-y-1">
                          <Label className="text-amber-100">Required reading / Read Me First</Label>
                          <p className="text-xs text-muted-foreground">
                            Put boss-required setup, safety, inspection, or handling notes here. After conversion, whichever employee is selected to start a timer must acknowledge this text first.
                          </p>
                        </div>
                        <Textarea
                          value={activePart.workInstructions}
                          onChange={(event) => updatePart(activePart.key, { workInstructions: event.target.value })}
                          placeholder="Example: Review rev C print; use fixture 207-B; first piece inspection required before continuing."
                          className="min-h-[130px] border-amber-500/25 bg-background/80"
                        />
                      </div>
                      <CustomerPartNoteSuggestions
                        suggestions={activePart.noteSuggestions ?? []}
                        onApply={(suggestion) => updatePart(activePart.key, {
                          [suggestion.destination]: appendSuggestedNote(activePart[suggestion.destination], suggestion.text),
                        })}
                      />
                    </div>
                    <AssignedItemsPanel
                      title="Work steps for this part"
                      description="These become the shop work plan. Pricing stays private to the admin."
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
                        const selected = activePart.addonSelections.find((selection) => selection.key === assignment.key);
                        const current = addonMap.get(assignment.itemId);
                        const addon = current
                          ? {
                              ...current,
                              rateType: selected?.rateTypeSnapshot ?? current.rateType,
                              rateCents: selected?.rateCentsSnapshot ?? current.rateCents,
                              affectsPrice: selected?.affectsPriceSnapshot ?? current.affectsPrice,
                              isChecklistItem: selected?.isChecklistItemSnapshot ?? current.isChecklistItem,
                            }
                          : null;
                        if (!addon) return null;
                        if (getWorkItemPricingSemantic(addon) === 'CHECKLIST_ONLY') {
                          return (
                            <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                              Shop step only — it does not add to the suggested price.
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
                                  {addon?.name ?? 'Unknown work step'} · {selection.units || '0'} unit(s)
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
                  <p className="text-sm text-muted-foreground">Select a part to add work steps and instructions.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <QuoteBuildDetailsCards
            fields={buildCustomFields}
            customFieldValues={customFieldValues}
            notes={form}
            onCustomFieldChange={(fieldId, value) => setCustomFieldValues((current) => ({ ...current, [fieldId]: value }))}
            onNotesChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          />

          <QuoteAttachmentsCard
            business={attachmentBusiness}
            pathPreview={attachmentPathPreview}
            attachments={attachments}
            onBusinessChange={setAttachmentBusiness}
            onChange={(key, patch) => setAttachments((current) => current.map((item) => (
              item.key === key ? { ...item, ...patch } : item
            )))}
            onUpload={handleAttachmentUpload}
            onRemove={(key) => setAttachments((current) => current.filter((item) => item.key !== key))}
            onAdd={addAttachment}
          />
        </>
      )}

      {currentStep === 4 && (
        <>
          <QuoteRoutingCard
            value={originDepartmentId}
            activeDepartments={activeDepartments}
            selectedDepartment={selectedOriginDepartment}
            loaded={departmentsLoaded}
            loadFailed={departmentsLoadFailed}
            onChange={setOriginDepartmentId}
          />

          <QuotePurchasedItemsCard
            parts={parts}
            vendors={vendors}
            items={vendorItems}
            onPartChange={updatePart}
            onItemChange={(key, patch) => setVendorItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item))}
            onRemoveItem={(key) => setVendorItems((current) => current.filter((item) => item.key !== key))}
            onAddItem={addVendorItem}
          />

          <Card>
            <CardHeader>
              <CardTitle>Final price for each part</CardTitle>
              <CardDescription>
                ShopApp suggests a unit price from the estimated work. Accept it, or enter the final price you want the customer to see.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {parts.map((part, index) => {
                const entry = partPricing.find((candidate) => candidate.partKey === part.key) ?? {
                  partKey: part.key,
                  price: '0.00',
                  pricingMode: 'PER_UNIT' as PartPricingMode,
                  priceSource: 'CALCULATED' as const,
                  suggestedUnitPriceCents: 0,
                };
                const quantity = Number.parseInt(part.quantity || '1', 10) || 1;
                const enteredPriceCents = entry.priceSource === 'MANUAL'
                  ? centsFromString(entry.price)
                  : entry.suggestedUnitPriceCents;
                const pricingMode = entry.priceSource === 'MANUAL' ? entry.pricingMode : 'PER_UNIT';
                const unitPrice = calculatePartUnitPrice({
                  enteredPriceCents,
                  quantity,
                  pricingMode,
                });
                const lotTotal = calculatePartLotTotal({
                  enteredPriceCents,
                  quantity,
                  pricingMode,
                });
                const workStepBreakdown = part.addonSelections.map((selection) => {
                  const addon = addonMap.get(selection.addonId);
                  const rateType = selection.rateTypeSnapshot ?? addon?.rateType ?? 'HOURLY';
                  const rateCents = selection.rateCentsSnapshot ?? addon?.rateCents ?? 0;
                  const affectsPrice = selection.affectsPriceSnapshot ?? addon?.affectsPrice ?? true;
                  const units = numberFromString(selection.units);
                  return {
                    key: selection.key,
                    name: selection.nameSnapshot ?? addon?.name ?? 'Work step',
                    units,
                    unitsLabel: getWorkItemUnitsLabel(rateType, 'short'),
                    rateLabel: formatWorkItemRateLabel({ rateCents, rateType }) ?? formatCurrency(rateCents),
                    affectsPrice,
                    totalCents: calculateAssignmentTotalCents({
                      item: { rateCents, rateType, affectsPrice },
                      units,
                    }),
                  };
                });
                const workSubtotalCents = workStepBreakdown.reduce((sum, step) => sum + step.totalCents, 0);
                const procurementCents = part.materialStatus === 'NEED_TO_ORDER'
                  ? calculateProcurementTotalCents({
                      baseCostCents: centsFromString(part.procurementCost),
                      markupPercent: Number.parseFloat(part.procurementMarkupPercent || '0'),
                    })
                  : 0;
                const isExpanded = expandedPartPricingKeys.has(part.key);
                return (
                  <div key={part.key} className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
                      <div>
                      <p className="text-sm font-medium">{part.partNumber || part.name || `Part ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground">{part.name || 'Unnamed part'}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Suggested unit price: <span className="font-semibold text-foreground">{formatCurrency(entry.suggestedUnitPriceCents)}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Includes {formatCurrency(workSubtotalCents)} in selected work steps
                          {procurementCents > 0 ? (
                            <> and {formatCurrency(procurementCents)} in purchased material</>
                          ) : null}
                          .
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedPartPricingKeys((current) => {
                              const next = new Set(current);
                              if (next.has(part.key)) next.delete(part.key);
                              else next.add(part.key);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? 'Hide price details' : 'View price details'}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-normal">
                        <Checkbox
                            checked={entry.priceSource === 'MANUAL'}
                          onCheckedChange={(checked) =>
                            setPartPricing((prev) =>
                              prev.map((row) =>
                                row.partKey === part.key
                                    ? {
                                        ...row,
                                        priceSource: checked ? 'MANUAL' : 'CALCULATED',
                                        price: checked ? row.price : (row.suggestedUnitPriceCents / 100).toFixed(2),
                                        pricingMode: 'PER_UNIT',
                                      }
                                  : row
                              )
                            )
                          }
                        />
                          Use a different final price
                      </Label>
                        {entry.priceSource === 'MANUAL' ? (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Manual price applies to</Label>
                              <Select
                                value={entry.pricingMode}
                                onValueChange={(value) =>
                                  setPartPricing((prev) =>
                                    prev.map((row) =>
                                      row.partKey === part.key
                                        ? { ...row, pricingMode: value as PartPricingMode }
                                        : row,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger aria-label="Manual price basis"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PER_UNIT">Each part</SelectItem>
                                  <SelectItem value="LOT_TOTAL">Whole quantity / lot</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                {entry.pricingMode === 'PER_UNIT' ? 'Final price per part' : 'Final price for the whole quantity'}
                              </Label>
                              <Input
                                inputMode="decimal"
                                value={entry.price}
                                onChange={(event) =>
                                  setPartPricing((prev) =>
                                    prev.map((row) =>
                                      row.partKey === part.key
                                        ? { ...row, price: event.target.value, priceSource: 'MANUAL' }
                                        : row,
                                    ),
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">The suggestion will update if estimated hours or rates change.</p>
                        )}
                    </div>
                      <div className="min-w-[170px] rounded-lg border border-border/60 bg-card p-3 text-sm">
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Qty</span><span>{quantity}</span></div>
                        <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">Per part</span><span>{formatCurrency(unitPrice)}</span></div>
                        <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">Price basis</span><span>{pricingMode === 'PER_UNIT' ? 'Each part' : 'Whole lot'}</span></div>
                        <div className="mt-2 flex justify-between gap-4 border-t border-border/60 pt-2 font-semibold"><span>Whole quantity</span><span>{formatCurrency(lotTotal)}</span></div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">Price details</p>
                          <span className="text-xs text-muted-foreground">
                            {entry.priceSource === 'MANUAL'
                              ? `Manual price for ${entry.pricingMode === 'PER_UNIT' ? 'each part' : 'the whole quantity'}`
                              : 'Calculated from the items below'}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {workStepBreakdown.length ? workStepBreakdown.map((step) => (
                            <div key={step.key} className="flex items-start justify-between gap-4 text-xs">
                              <div>
                                <p className="font-medium text-foreground">{step.name}</p>
                                <p className="text-muted-foreground">
                                  {step.units} {step.unitsLabel} at {step.rateLabel}
                                  {!step.affectsPrice ? ' (checklist only)' : ''}
                                </p>
                              </div>
                              <span className="shrink-0 font-medium">{step.affectsPrice ? formatCurrency(step.totalCents) : 'Included'}</span>
                            </div>
                          )) : (
                            <p className="text-xs text-muted-foreground">No work steps have been selected for this part.</p>
                          )}
                          {part.materialStatus === 'NEED_TO_ORDER' ? (
                            <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-2 text-xs">
                              <div>
                                <p className="font-medium text-foreground">Purchased material</p>
                                <p className="text-muted-foreground">
                                  {formatCurrency(centsFromString(part.procurementCost))}
                                  {Number.parseFloat(part.procurementMarkupPercent || '0') > 0
                                    ? ` + ${part.procurementMarkupPercent}% markup`
                                    : ''}
                                </p>
                              </div>
                              <span className="shrink-0 font-medium">{formatCurrency(procurementCents)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <QuoteCustomAmountsCard
            items={customAmounts}
            onChange={updateCustomAmount}
            onRemove={removeCustomAmount}
            onAdd={addCustomAmount}
          />

          <QuoteTotalsSummaryCard
            basePriceCents={basePriceCents}
            vendorTotalsCents={vendorTotalsCents}
            partPricingTotalCents={partPricingTotalCents}
            customAmountsTotalCents={customAmountsTotalCents}
            totalCents={totalCents}
            loading={loading}
            onCancel={() => router.back()}
          />
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
          <Button type="button" onClick={() => void saveAndContinue()} disabled={loading}>
            {loading ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      )}
    </form>
  );
}
