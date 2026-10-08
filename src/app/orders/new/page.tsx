"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { NewOrderCustomerInput } from './NewOrderCustomerDialog';
import { NewOrderDrawingEntryPanel } from './NewOrderDrawingEntryPanel';
import { NewOrderInfoCards } from './NewOrderInfoCards';
import { NewOrderPartEntryChooser } from './NewOrderPartEntryChooser';
import {
  NewOrderPartsEditor,
  type NewOrderAddonOption as AddonOption,
  type NewOrderPartAddonSelection as PartAddonSelection,
  type NewOrderPartInput as PartInput,
} from './NewOrderPartsEditor';
import { NewOrderReviewSummaryCards } from './NewOrderReviewSummaryCards';
import { NewOrderAttachmentsCard } from './NewOrderAttachmentsCard';
import { NewOrderLaunchNotesCard } from './NewOrderLaunchNotesCard';
import { NewOrderSubmitCard } from './NewOrderSubmitCard';
import { NewOrderWizardNavigation, NewOrderWizardProgress } from './NewOrderWizardControls';
import {
  BUSINESS_OPTIONS,
  getBusinessOptionByCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';
import type { CustomFieldDefinition } from '@/components/CustomFieldInputs';
import { hasCustomFieldValue } from '@/lib/custom-field-values';
import { calculateWorkItemsSubtotalCents } from '@/modules/pricing/work-item-pricing';
import { calculatePartLotTotal, type PartPricingMode } from '@/modules/pricing/part-pricing';
import type { RepeatOrderTemplateDetail } from '@/modules/repeat-orders/repeat-orders.types';
import { resolveRepeatOrderCustomer } from '@/modules/repeat-orders/repeat-order-customer';
import { loadRepeatOrderTemplate } from '@/modules/order-intake/order-prefill.client';
import { loadQuoteForOrder, mapQuoteToOrderPrefill } from '@/modules/order-intake/order-quote-prefill.client';
import type { ReviewedDrawingPart } from '@/components/orders/DrawingImportPanel';
import { createQuoteDrawingImportV2ApiClient } from '@/components/orders/drawing-import/drawing-import-v2-api-client';
import { buildFinishPartNotes } from '@/modules/drawing-import/drawing-import.materials';
import { clearDrawingImportDraft } from '@/modules/drawing-import/drawing-import.draft';
import { normalizeOrderQuantityInput } from '@/modules/orders/order-input';
import { intakeDraftKey } from '@/modules/intake-drafts/intake-draft';
import { useDurableIntakeDraft } from '@/modules/intake-drafts/use-durable-intake-draft';
import { IntakeDraftStatus } from '@/components/IntakeDraftStatus';
import { PendingSubmissionRecovery } from '@/components/PendingSubmissionRecovery';
import { createPendingCreationSubmission, parsePendingCreationSubmission, lookupPendingCreationSubmission, submitPendingCreationSubmission, type PendingCreationSubmission } from '@/modules/submissions/submissions.client';
import { orderDraftTarget, mergeImportedOrderParts, mergeOrderDraftFiles, orderPartReadiness, orderPartHasInput } from '@/modules/order-intake/order-draft.client';
import type { ReviewedQuoteDrawingPartV2 } from '@/components/orders/drawing-import/drawing-import-ui.types';
import { CustomerPartPicker } from '@/components/customer-parts/CustomerPartPicker';
import type { CustomerPartReusableDraft } from '@/modules/customer-parts/customer-parts.types';
import {
  createIntakeKey as createKey,
  defaultIntakeDueDate as defaultDueDate,
  numberFromIntakeDraft as numberFromString,
  type IntakeCustomerOption,
} from '@/modules/order-intake/order-intake.client';

const priorities = ['LOW', 'NORMAL', 'RUSH', 'HOT'];

const DEFAULT_BUSINESS_OPTION = BUSINESS_OPTIONS[0];
const DEFAULT_BUSINESS_NAME = (DEFAULT_BUSINESS_OPTION?.name ?? 'Sterling Tool and Die') as BusinessName;
const DEFAULT_BUSINESS_CODE = (DEFAULT_BUSINESS_OPTION?.code ?? 'STD') as BusinessCode;
type Option = IntakeCustomerOption;

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
  partName: '',
  quantity: '1',
  materialId: '',
  stockSize: '',
  cutLength: '',
  partWidth: '',
  partThickness: '',
  notes: '',
  workInstructions: '',
  addonSelections: [],
  templateCharges: [],
  templateAttachments: [],
  attachments: [],
});
const emptyAttachment = (): AttachmentInput => ({ url: '', storagePath: '', label: '', mimeType: '', uploading: false });

function NewOrderForm() {
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = React.useState('');
  const [customerContactId, setCustomerContactId] = React.useState('');
  const [customers, setCustomers] = React.useState<Option[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = React.useState(false);
  const [vendors, setVendors] = React.useState<Option[]>([]);
  const [materials, setMaterials] = React.useState<Option[]>([]);
  const [machinists, setMachinists] = React.useState<Option[]>([]);
  const [addons, setAddons] = React.useState<AddonOption[]>([]);
  const [vendorId, setVendorId] = React.useState('');
  const [poNumber, setPoNumber] = React.useState('');
  const [assignedMachinistId, setAssignedMachinistId] = React.useState('');
  const [assignedWorkerIds, setAssignedWorkerIds] = React.useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState('');
  const [priority, setPriority] = React.useState('NORMAL');
  const [business, setBusiness] = React.useState<BusinessCode>(DEFAULT_BUSINESS_CODE);
  const [parts, setParts] = React.useState<PartInput[]>([emptyPart()]);
  const [partPricing, setPartPricing] = React.useState<PartPricingState[]>([{ partKey: parts[0]?.key ?? createKey(), price: '0.00', pricingMode: 'LOT_TOTAL' }]);
  const [activePartKey, setActivePartKey] = React.useState(parts[0]?.key ?? createKey());
  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([emptyAttachment()]);
  const [attachmentBusiness, setAttachmentBusiness] = React.useState<BusinessName>(DEFAULT_BUSINESS_NAME);
  const [draftAttachmentReference, setDraftAttachmentReference] = React.useState(() => createKey());
  const [materialNeeded, setMaterialNeeded] = React.useState(false);
  const [materialOrdered, setMaterialOrdered] = React.useState(false);
  const [modelIncluded, setModelIncluded] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [customFields, setCustomFields] = React.useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(false);
  const submissionInFlight = React.useRef(false);
  const [message, setMessage] = React.useState('');
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(null);
  const [quotePrefillError, setQuotePrefillError] = React.useState<string | null>(null);
  const [quotePrefillLoading, setQuotePrefillLoading] = React.useState(false);
  const [repeatTemplate, setRepeatTemplate] = React.useState<RepeatOrderTemplateDetail | null>(null);
  const [repeatTemplateError, setRepeatTemplateError] = React.useState<string | null>(null);
  const [repeatTemplateLoading, setRepeatTemplateLoading] = React.useState(false);
  const [repeatTemplateRetry, setRepeatTemplateRetry] = React.useState(0);
  const [quotePrefillRetry, setQuotePrefillRetry] = React.useState(0);
  const [sourceReadyKey, setSourceReadyKey] = React.useState<string | null>(null);
  const [pendingSubmission, setPendingSubmission] = React.useState<PendingCreationSubmission | null>(null);
  const pendingSubmissionRef = React.useRef<PendingCreationSubmission | null>(null);
  const restoredDraftKey = React.useRef<string | null>(null);
  const [customFieldsReady, setCustomFieldsReady] = React.useState(false);
  const [customFieldsError, setCustomFieldsError] = React.useState('');
  const [currentStep, setCurrentStep] = React.useState(0);
  const [partEntryMode, setPartEntryMode] = React.useState<'manual' | 'drawing' | 'existing' | null>(null);
  const [legacyDrawingReader, setLegacyDrawingReader] = React.useState(false);
  const currentDrawingReader = React.useMemo(() => createQuoteDrawingImportV2ApiClient('order'), []);
  const templateId = searchParams.get('templateId');
  const quoteId = searchParams.get('quoteId');
  const templateMode = Boolean(templateId);
  const conversionMode = !templateMode && Boolean(quoteId);
  const freshOrderMode = !templateMode && !conversionMode;
  const draftTarget = React.useMemo(() => orderDraftTarget(templateId, conversionMode ? quoteId : null), [templateId, conversionMode, quoteId]);
  const suppressOrderDraft = React.useRef(false);
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
    fetch('/api/admin/customers?take=5000', { credentials: 'include' })
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

    fetch('/api/admin/users?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        const raw = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setMachinists(
          raw
            .filter((m: any) => m?.active !== false && m?.role !== 'VIEWER')
            .map((m: any) => ({
              id: m.id,
              name: m.name || m.email || 'Unnamed employee',
            }))
        );
      })
      .catch(() => setMachinists([]));

    fetch('/api/orders/addons?active=true&take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setAddons((data.items ?? []).filter((item: AddonOption) => item.active !== false)))
      .catch(() => setAddons([]));
  }, []);

  const durableDraft = useDurableIntakeDraft<Record<string, unknown>>({
    kind: 'order', key: draftTarget.key, legacyStorageKey: freshOrderMode ? intakeDraftKey('order') : undefined,
    onRestore(data) {
      const draft = data as Record<string, any>;
      const pending = parsePendingCreationSubmission(draft.pendingSubmission, draftTarget.scope, draftTarget.url);
      if (draft.pendingSubmission && !pending) throw new Error('The saved submission could not be verified. Keep this draft and request help before creating another order.');
      restoredDraftKey.current = draftTarget.key;
      suppressOrderDraft.current = false;
      pendingSubmissionRef.current = pending;
      setPendingSubmission(pending);
      if (typeof draft.draftAttachmentReference === 'string' && draft.draftAttachmentReference) setDraftAttachmentReference(draft.draftAttachmentReference);
      if (typeof draft.customerId === 'string') setCustomerId(draft.customerId);
      if (typeof draft.customerContactId === 'string') setCustomerContactId(draft.customerContactId);
      if (typeof draft.vendorId === 'string') setVendorId(draft.vendorId);
      if (typeof draft.poNumber === 'string') setPoNumber(draft.poNumber);
      if (typeof draft.assignedMachinistId === 'string') setAssignedMachinistId(draft.assignedMachinistId);
      if (Array.isArray(draft.assignedWorkerIds)) setAssignedWorkerIds(draft.assignedWorkerIds.filter((value: unknown) => typeof value === 'string'));
      if (Array.isArray(draft.selectedAddonIds)) setSelectedAddonIds(draft.selectedAddonIds.filter((value: unknown) => typeof value === 'string'));
      if (typeof draft.dueDate === 'string') setDueDate(draft.dueDate);
      if (priorities.includes(draft.priority)) setPriority(draft.priority);
      if (BUSINESS_OPTIONS.some((option) => option.code === draft.business)) setBusiness(draft.business);
      if (Array.isArray(draft.parts)) setParts(draft.parts);
      if (Array.isArray(draft.partPricing)) setPartPricing(draft.partPricing);
      if (typeof draft.activePartKey === 'string') setActivePartKey(draft.activePartKey);
      if (Array.isArray(draft.attachments)) setAttachments(draft.attachments.map((attachment: AttachmentInput) => ({ ...attachment, uploading: false })));
      if (BUSINESS_OPTIONS.some((option) => option.name === draft.attachmentBusiness)) setAttachmentBusiness(draft.attachmentBusiness as BusinessName);
      setMaterialNeeded(Boolean(draft.materialNeeded)); setMaterialOrdered(Boolean(draft.materialOrdered)); setModelIncluded(Boolean(draft.modelIncluded));
      if (typeof draft.notes === 'string') setNotes(draft.notes);
      if (draft.customFieldValues && typeof draft.customFieldValues === 'object') setCustomFieldValues(draft.customFieldValues);
      if (Number.isInteger(draft.currentStep)) setCurrentStep(Math.max(0, Math.min(2, draft.currentStep)));
      if (draft.partEntryMode === 'manual' || draft.partEntryMode === 'drawing' || draft.partEntryMode === 'existing') setPartEntryMode(draft.partEntryMode);
      setMessage(pending ? 'Recovered your saved submission. Check its result before making changes.' : 'Recovered your saved order draft.');
    },
  });

  const prefillReady = freshOrderMode || sourceReadyKey === draftTarget.key;
  const draftData = React.useMemo(() => ({
    draftAttachmentReference, customerId, customerContactId, vendorId, poNumber, assignedMachinistId, assignedWorkerIds,
    selectedAddonIds, dueDate, priority, business, parts, partPricing, activePartKey,
    attachments: attachments.map((attachment) => ({ ...attachment, uploading: false })), attachmentBusiness,
    materialNeeded, materialOrdered, modelIncluded, notes, customFieldValues, currentStep, partEntryMode, pendingSubmission,
  }), [activePartKey, assignedMachinistId, assignedWorkerIds, attachmentBusiness, attachments, business, currentStep, customFieldValues, customerContactId, customerId, draftAttachmentReference, dueDate, materialNeeded, materialOrdered, modelIncluded, notes, partEntryMode, partPricing, parts, pendingSubmission, poNumber, priority, selectedAddonIds, vendorId]);

  const { ready: draftReady, legacyAvailable, schedule: scheduleDraft } = durableDraft;
  React.useEffect(() => {
    if (!draftReady || legacyAvailable || !prefillReady || suppressOrderDraft.current || submissionInFlight.current || pendingSubmissionRef.current) return;
    scheduleDraft(draftData);
  }, [draftData, draftReady, legacyAvailable, scheduleDraft, prefillReady]);

  React.useEffect(() => {
    const option = getBusinessOptionByCode(business);
    if (option) {
      setAttachmentBusiness(option.name as BusinessName);
    }
  }, [business]);

  React.useEffect(() => {
    let active = true;
    setCustomFieldsReady(false);
    setCustomFieldsError('');
    fetch(`/api/custom-fields?entityType=ORDER&businessCode=${business}&isActive=true`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!active) return;
        const nextFields = data.items ?? [];
        setCustomFields(nextFields);
        setCustomFieldValues((prev) => {
          const next: Record<string, unknown> = { ...prev };
          nextFields.forEach((field: CustomFieldDefinition) => {
            if (prev[field.id] !== undefined) next[field.id] = prev[field.id];
            else if (field.defaultValue !== undefined) next[field.id] = field.defaultValue;
          });
          return next;
        });
      })
      .catch(() => { if (active) setCustomFieldsError('Required order fields could not load. Refresh to retry; your saved draft will be kept.'); })
      .finally(() => { if (active) setCustomFieldsReady(true); });
    return () => { active = false; };
  }, [business]);

  React.useEffect(() => {
    if (!templateId) {
      setRepeatTemplate(null);
      setRepeatTemplateError(null);
      setRepeatTemplateLoading(false);
      return;
    }
    if (!durableDraft.ready || durableDraft.legacyAvailable) return;
    setRepeatTemplateLoading(true);
    setRepeatTemplateError(null);
    const controller = new AbortController();
    loadRepeatOrderTemplate(templateId, controller.signal)
      .then((template) => {
        if (controller.signal.aborted) return;
        setRepeatTemplate(template);
        setSourceReadyKey(draftTarget.key);
        if (restoredDraftKey.current === draftTarget.key) return;
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
                  partName: part.partName ?? '',
                  quantity: String(part.quantity ?? 1),
                  materialId: part.materialId ?? '',
                  stockSize: part.stockSize ?? '',
                  cutLength: part.cutLength ?? '',
                  partWidth: part.partWidth ?? '',
                  partThickness: part.partThickness ?? '',
                  notes: part.notes ?? '',
                  workInstructions: part.workInstructions ?? '',
                  addonSelections: [],
                  templateCharges: Array.isArray(part.charges) ? part.charges : [],
                  templateAttachments: Array.isArray(part.attachments) ? part.attachments : [],
                  attachments: [],
                }))
            : [emptyPart()]
        );
      })
      .catch((problem) => {
        if (problem instanceof DOMException && problem.name === 'AbortError') return;
        setRepeatTemplate(null);
        setRepeatTemplateError('The repeat template did not load. Retry it before creating this order.');
      })
      .finally(() => { if (!controller.signal.aborted) setRepeatTemplateLoading(false); });
    return () => controller.abort();
  }, [templateId, repeatTemplateRetry, durableDraft.ready, durableDraft.legacyAvailable, draftTarget.key]);

  React.useEffect(() => {
    if (templateMode || !quoteId || !durableDraft.ready || durableDraft.legacyAvailable) return;
    let active = true;
    setQuotePrefillLoading(true);
    setQuotePrefillError(null);
    loadQuoteForOrder(quoteId)
      .then((quote) => {
        if (!active) return;
        setSourceReadyKey(draftTarget.key);
        if (restoredDraftKey.current === draftTarget.key) return;
        const prefill = mapQuoteToOrderPrefill(quote, createKey);
        setBusiness(prefill.business as BusinessCode);
        setCustomerId(prefill.customerId);
        setCustomerContactId(prefill.customerContactId);
        setModelIncluded(prefill.modelIncluded);
        setParts(prefill.parts.length ? prefill.parts : [emptyPart()]);
        setSelectedAddonIds(prefill.selectedAddonIds);
        if (prefill.addonSnapshots.length > 0) {
          setAddons((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const missing = prefill.addonSnapshots.filter((item) => !existingIds.has(item.id));
            return missing.length ? [...prev, ...missing] : prev;
          });
        }
        setDueDate(prefill.dueDate || defaultDueDate());
        setNotes((prev) => prev || prefill.note);
      })
      .catch(() => {
        if (active) setQuotePrefillError('The quote could not load. Retry the quote before creating this order; your saved entries are kept.');
      })
      .finally(() => { if (active) setQuotePrefillLoading(false); });
    return () => { active = false; };
  }, [quoteId, templateMode, quotePrefillRetry, durableDraft.ready, durableDraft.legacyAvailable, draftTarget.key]);

  React.useEffect(() => {
    if (!parts.length) return;
    if (parts.some((part) => part.key === activePartKey)) return;
    setActivePartKey(parts[0]?.key ?? createKey());
  }, [activePartKey, parts]);

  React.useEffect(() => {
    if (!conversionMode || !quoteId || !prefillReady || restoredDraftKey.current === draftTarget.key || pendingSubmissionRef.current) return;
    let active = true;
    fetch(`/api/admin/quotes/${quoteId}/detect-po`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const detected = typeof data?.poNumber === 'string' ? data.poNumber.trim() : '';
        if (!active || !detected) return;
        setPoNumber((current) => current.trim() ? current : detected);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [conversionMode, quoteId, prefillReady, draftTarget.key]);

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
        const quantity = normalizeOrderQuantityInput(part?.quantity);
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
    setParts((prev) => prev.map((part) => {
      if (part.key !== key) return part;
      const resolved = new Set([
        ...(patch.materialId?.trim() ? ['material'] : []),
        ...(patch.finalPartLength?.trim() ? ['finalLength'] : []),
        ...(patch.partWidth?.trim() ? ['partWidth'] : []),
        ...(patch.partThickness?.trim() ? ['partThickness'] : []),
      ]);
      return { ...part, ...patch, unresolvedFields: part.unresolvedFields?.filter((field) => !resolved.has(field)) };
    }));
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

  async function createDrawingMaterial(name: string) {
    const response = await fetch('/api/admin/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not add material.');
    const material = data.item ?? data;
    setMaterials((current) => [...current, material]);
    return material;
  }

  async function applyImportedDrawingParts(importedParts: (ReviewedDrawingPart | ReviewedQuoteDrawingPartV2)[], orderFiles: ReviewedDrawingPart['source'][]) {
    if (!durableDraft.ready || durableDraft.editingBlocked || pendingSubmissionRef.current || submissionInFlight.current) throw new Error('Wait for the saved draft before transferring these drawings.');
    const nextParts: PartInput[] = importedParts.map((part) => ({
      ...emptyPart(),
      key: part.key,
      drawingImportPageId: 'importPageId' in part ? part.importPageId : undefined,
      unresolvedFields: 'unresolvedFields' in part ? part.unresolvedFields : undefined,
      reviewWarnings: 'reviewWarnings' in part ? part.reviewWarnings : undefined,
      partNumber: part.partNumber,
      partName: part.partName,
      quantity: String(part.quantity),
      materialId: part.materialId,
      stockSize: part.stockSize,
      cutLength: part.cutLength,
      finalPartLength: part.finalPartLength,
      drawingMaterialText: part.drawingMaterialText,
      drawingFinishText: part.drawingFinishText,
      finish: part.finish,
      partWidth: part.partWidth,
      partThickness: part.partThickness,
      notes: buildFinishPartNotes(part.finish),
      noteSuggestions: 'noteSuggestions' in part && Array.isArray(part.noteSuggestions) ? part.noteSuggestions : [],
      attachments: [{
        kind: part.source.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE',
        storagePath: part.source.storagePath,
        label: part.source.label,
        mimeType: part.source.mimeType,
      }],
    }));
    const existingParts = parts.filter(orderPartHasInput);
    const combinedParts = nextParts.length ? mergeImportedOrderParts(existingParts, nextParts) : parts;
    const combinedFiles = mergeOrderDraftFiles(attachments, orderFiles.map((source) => ({
          url: '',
          storagePath: source.storagePath,
          label: source.label,
          mimeType: source.mimeType,
          uploading: false,
    })));
    const nextActive = nextParts[0]?.key ?? activePartKey;
    const candidate = { ...draftData, parts: combinedParts, attachments: combinedFiles, activePartKey: nextActive, partEntryMode: 'manual' };
    submissionInFlight.current = true;
    setLoading(true);
    try {
      // Suppress parent autosave and edits until the acknowledged snapshot becomes visible.
      if (!await durableDraft.flush(candidate)) throw new Error('The order draft could not be saved. Your drawing review is kept here; retry the transfer.');
      setParts(combinedParts);
      setAttachments(combinedFiles);
      setActivePartKey(nextActive);
      setPartEntryMode('manual');
      setMessage(`${nextParts.length} part drawing${nextParts.length === 1 ? '' : 's'} saved to the draft${orderFiles.length ? `; ${orderFiles.length} supporting file${orderFiles.length === 1 ? '' : 's'} kept with the order` : ''}. Review the parts below, then continue.`);
    } finally {
      submissionInFlight.current = false;
      setLoading(false);
    }
  }

  function addPreexistingOrderParts(drafts: CustomerPartReusableDraft[]) {
    const nextParts: PartInput[] = drafts.map((draft) => ({
      ...emptyPart(),
      key: draft.key,
      partNumber: draft.partNumber,
      partName: draft.partName,
      quantity: '1',
      materialId: draft.materialId,
      drawingMaterialText: draft.drawingMaterialText,
      drawingFinishText: draft.drawingFinishText,
      finish: draft.finish,
      stockSize: draft.stockSize,
      cutLength: draft.cutLength,
      finalPartLength: draft.finalPartLength,
      partWidth: draft.partWidth,
      partThickness: draft.partThickness,
      notes: '',
      workInstructions: '',
      noteSuggestions: draft.noteSuggestions,
      attachments: draft.attachments
        .filter((attachment) => Boolean(attachment.storagePath))
        .map((attachment) => ({
          kind: attachment.kind,
          storagePath: attachment.storagePath ?? '',
          label: attachment.label ?? '',
          mimeType: attachment.mimeType ?? '',
        })),
    }));
    if (!nextParts.length) return;
    setParts((current) => {
      const retained = current.filter(orderPartHasInput);
      return [...retained, ...nextParts];
    });
    setActivePartKey(nextParts[0].key);
    setPartEntryMode('manual');
    setMessage(`${nextParts.length} preexisting customer part${nextParts.length === 1 ? '' : 's'} added for review.`);
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
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setLoading(true);
    try {
      await submitOrder();
    } catch {
      setMessage('ShopApp could not confirm whether the order was created. Check Orders before trying again. Your entries have been kept.');
    } finally {
      submissionInFlight.current = false;
      setLoading(false);
    }
  }

  async function submitOrder() {
    setMessage('');
    setCreatedOrderId(null);
    if (pendingSubmissionRef.current) { setMessage('Check or retry your saved submission below.'); return; }
    if (!durableDraft.ready || durableDraft.legacyAvailable || !prefillReady || suppressOrderDraft.current) { setMessage('Wait for the saved draft and order source to load, or finish discarding this draft.'); return; }
    if (!validateStep(2)) return;

    const cleanedParts = parts
      .map((part) => ({
        sourceQuotePartId: part.sourceQuotePartId,
        partNumber: part.partNumber.trim(),
        partName: part.partName.trim() || undefined,
        quantity: normalizeOrderQuantityInput(part.quantity),
        materialId: part.materialId ? part.materialId : undefined,
        stockSize: part.stockSize?.trim() ? part.stockSize.trim() : undefined,
        cutLength: part.cutLength?.trim() ? part.cutLength.trim() : undefined,
        finalPartLength: part.finalPartLength?.trim() || undefined,
        drawingMaterialText: part.drawingMaterialText?.trim() || undefined,
        drawingFinishText: part.drawingFinishText?.trim() || undefined,
        finish: part.finish?.trim() || undefined,
        partWidth: part.partWidth?.trim() ? part.partWidth.trim() : undefined,
        partThickness: part.partThickness?.trim() ? part.partThickness.trim() : undefined,
        notes: part.notes?.trim() ? part.notes.trim() : undefined,
        workInstructions: part.workInstructions?.trim() ? part.workInstructions.trim() : undefined,
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
        attachments: part.attachments,
      }))
      .filter((part) => part.partNumber.length > 0);
    const cleanedTemplateParts = parts
      .map((part) => ({
        templatePartId: part.templatePartId?.trim() || '',
        quantity: normalizeOrderQuantityInput(part.quantity),
        notes: part.notes?.trim() ? part.notes.trim() : null,
        workInstructions: part.workInstructions?.trim() ? part.workInstructions.trim() : null,
      }))
      .filter((part) => part.templatePartId.length > 0);

    const resolvedCustomerId = resolveRepeatOrderCustomer(customerId, templateMode ? repeatTemplate?.customerId : null);
    if (!resolvedCustomerId) {
      setMessage('Please choose a customer.');
      setCurrentStep(0);
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
      customerContactId: customerContactId || undefined,
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
      assignedWorkerIds,
      parts: cleanedParts,
      addonIds: selectedAddonIds,
      attachments: cleanAttachments,
      notes: notes.trim() ? notes.trim() : undefined,
      customFieldValues: customFields
        .map((field) => ({ fieldId: field.id, value: customFieldValues[field.id] }))
        .filter((entry) => hasCustomFieldValue(entry.value)),
    } as any;

    const payload = templateMode ? {
      customerId: resolvedCustomerId, dueDate: resolvedDueDate, priority,
      vendorId: vendorId || undefined, poNumber: poNumber || undefined,
      assignedMachinistId: assignedMachinistId || undefined, materialNeeded, materialOrdered, modelIncluded,
      notes: notes.trim() || undefined, parts: cleanedTemplateParts,
    } : conversionMode ? {
      dueDate: resolvedDueDate, priority, vendorId: vendorId || undefined, poNumber: poNumber || undefined,
      assignedMachinistId: assignedMachinistId || undefined, assignedWorkerIds, materialNeeded, materialOrdered,
      modelIncluded, parts: cleanedParts, notes: notes.trim() || undefined, customFieldValues: body.customFieldValues,
    } : body;
    const pending = createPendingCreationSubmission(draftTarget.scope, draftTarget.url, payload);
    pendingSubmissionRef.current = pending;
    setPendingSubmission(pending);
    if (!await durableDraft.flush({ ...draftData, pendingSubmission: pending })) {
      setMessage('Your submission has not been sent because the draft could not be saved. Retry the saved submission after the save issue is resolved.');
      return;
    }
    await completeSavedSubmission(pending, false);
  }

  async function completeSavedSubmission(pending: PendingCreationSubmission, checkOnly: boolean) {
    const result = checkOnly ? await lookupPendingCreationSubmission(pending) : await submitPendingCreationSubmission(pending);
    if (result.state === 'created') {
      suppressOrderDraft.current = true;
      setCreatedOrderId(result.id);
      if (!await durableDraft.clear()) {
        setMessage('Order created, but its draft cleanup could not be confirmed. Check the saved submission again to finish safely.');
        return;
      }
      try {
        clearDrawingImportDraft(window.localStorage, {
          destination: 'order', business: attachmentBusiness,
          customerName: customers.find((customer) => customer.id === customerId)?.name ?? '',
        });
      } catch { /* The server acknowledgment is authoritative even if browser storage is unavailable. */ }
      setMessage('Order created. Opening the order…');
      router.push(`/orders/${result.id}`);
      return;
    }
    if (result.state === 'rejected') {
      if (!await durableDraft.flush({ ...draftData, pendingSubmission: null })) {
        setMessage(`${result.error} The pending request could not be cleared from the saved draft. Keep this page and retry after the save issue is resolved.`);
        return;
      }
      pendingSubmissionRef.current = null;
      setPendingSubmission(null);
    }
    setMessage(result.error);
  }

  async function recoverSubmission(checkOnly: boolean) {
    const pending = pendingSubmissionRef.current;
    if (!pending || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setLoading(true);
    try {
      // A result lookup is always allowed, including after successful creation with failed draft cleanup.
      if (!checkOnly && !await durableDraft.flush({ ...draftData, pendingSubmission: pending })) {
        setMessage('The saved request could not be persisted. Check its result, or resolve the draft save issue before retrying.');
        return;
      }
      await completeSavedSubmission(pending, checkOnly);
    } catch {
      setMessage('The result could not be confirmed. Your exact saved submission is kept; use Check saved submission or Retry saved submission.');
    } finally {
      submissionInFlight.current = false;
      setLoading(false);
    }
  }

  function validateStep(throughStep: number) {
    if (templateMode && !repeatTemplate) { setMessage('Retry the repeat template before continuing.'); setCurrentStep(0); return false; }
    if (quotePrefillError || repeatTemplateError || !prefillReady) { setMessage('Wait for the source to load, or retry it above. Your draft is kept.'); setCurrentStep(0); return false; }
    if (!resolveRepeatOrderCustomer(customerId, templateMode ? repeatTemplate?.customerId : null)) { setMessage('Choose a customer before continuing.'); setCurrentStep(0); return false; }
    if (!templateMode && (!customFieldsReady || customFieldsError)) { setMessage(customFieldsError || 'Wait for the required order fields to load.'); setCurrentStep(0); return false; }
    const missing = templateMode ? [] : customFields.filter((field) => field.isRequired && !hasCustomFieldValue(customFieldValues[field.id]));
    if (missing.length) { setMessage(`Fill in required custom fields: ${missing.map((field) => field.name).join(', ')}.`); setCurrentStep(0); return false; }
    if (throughStep >= 1) {
      const problem = orderPartReadiness(parts);
      if (problem) { setMessage(problem.message); setCurrentStep(1); if (problem.partKey) setActivePartKey(problem.partKey); return false; }
    }
    if (attachments.some((attachment) => attachment.uploading)) { setMessage('Wait for attachment uploads to finish before continuing.'); return false; }
    return true;
  }

  function selectStep(next: number) {
    if (loading || durableDraft.editingBlocked || pendingSubmissionRef.current || !durableDraft.ready || durableDraft.legacyAvailable || !prefillReady) return;
    if (next > currentStep && !validateStep(next - 1)) return;
    setMessage('');
    setCurrentStep(next);
  }

  async function discardDraft() {
    if (pendingSubmissionRef.current || submissionInFlight.current) return;
    suppressOrderDraft.current = true;
    if (await durableDraft.clear()) window.location.reload();
    else setMessage('The draft was kept because the server could not confirm deletion. Retry discarding when connected.');
  }

  async function cancelOrderEntry() {
    if (submissionInFlight.current || pendingSubmissionRef.current) return;
    submissionInFlight.current = true;
    setLoading(true);
    try {
      if (await durableDraft.flush(draftData)) router.push('/');
      else setMessage('Your draft could not be saved. Stay here and retry saving before leaving.');
    } finally {
      submissionInFlight.current = false;
      setLoading(false);
    }
  }

  async function createCustomer(payload: NewOrderCustomerInput) {
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
      setCustomerContactId(data.item.contacts?.[0]?.id ?? '');
      return true;
    }
    return false;
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
        <IntakeDraftStatus draft={durableDraft} disabled={loading} onDiscard={!pendingSubmission && !createdOrderId ? () => void discardDraft() : undefined} />
        {pendingSubmission && <PendingSubmissionRecovery busy={loading} onCheck={() => void recoverSubmission(true)} onRetry={() => void recoverSubmission(false)} />}
        {message && <p role="alert" className="text-sm text-foreground">{message}</p>}
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
        {repeatTemplateError ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">{repeatTemplateError}</p><Button type="button" size="sm" variant="outline" onClick={() => setRepeatTemplateRetry((value) => value + 1)}>Retry template</Button></div> : null}
        {quotePrefillLoading && conversionMode && (
          <p className="text-sm text-muted-foreground">Prefilling from quote…</p>
        )}
        {quotePrefillError && <div className="flex items-center gap-3"><p className="text-sm text-destructive">{quotePrefillError}</p><Button type="button" size="sm" variant="outline" onClick={() => setQuotePrefillRetry((value) => value + 1)}>Retry quote</Button></div>}
      </div>

      <NewOrderWizardProgress
        steps={steps}
        currentStep={currentStep}
        disabled={loading || durableDraft.editingBlocked || Boolean(pendingSubmission) || !durableDraft.ready || !prefillReady || durableDraft.legacyAvailable}
        onSelect={selectStep}
      />

      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <fieldset className="contents" disabled={loading || durableDraft.editingBlocked || Boolean(pendingSubmission) || !durableDraft.ready || durableDraft.legacyAvailable || !prefillReady}>
        {currentStep === 0 && (
          <NewOrderInfoCards
            header={{ business, customerId, customerContactId, dueDate, priority, assignedMachinistId, assignedWorkerIds, poNumber }}
            sourcing={{ vendorId, materialNeeded, materialOrdered, modelIncluded }}
            customers={customers}
            machinists={machinists}
            vendors={vendors}
            customFields={customFields}
            customFieldValues={customFieldValues}
            templateMode={templateMode}
            conversionMode={conversionMode}
            templateCustomer={templateMode && repeatTemplate?.customerId ? { id: repeatTemplate.customerId, name: repeatTemplate.customerName } : null}
            customerDialogOpen={customerDialogOpen}
            onCustomerDialogOpenChange={setCustomerDialogOpen}
            onCreateCustomer={createCustomer}
            onHeaderChange={(patch) => {
              if (patch.business !== undefined) setBusiness(patch.business);
              if (patch.customerId !== undefined) setCustomerId(patch.customerId);
              if (patch.customerContactId !== undefined) setCustomerContactId(patch.customerContactId);
              if (patch.dueDate !== undefined) setDueDate(patch.dueDate);
              if (patch.priority !== undefined) setPriority(patch.priority);
              if (patch.assignedMachinistId !== undefined) setAssignedMachinistId(patch.assignedMachinistId);
              if (patch.assignedWorkerIds !== undefined) setAssignedWorkerIds(patch.assignedWorkerIds);
              if (patch.poNumber !== undefined) setPoNumber(patch.poNumber);
            }}
            onSourcingChange={(patch) => {
              if (patch.vendorId !== undefined) setVendorId(patch.vendorId);
              if (patch.materialNeeded !== undefined) setMaterialNeeded(patch.materialNeeded);
              if (patch.materialOrdered !== undefined) setMaterialOrdered(patch.materialOrdered);
              if (patch.modelIncluded !== undefined) setModelIncluded(patch.modelIncluded);
            }}
            onCustomFieldChange={(fieldId, value) => setCustomFieldValues((current) => ({ ...current, [fieldId]: value }))}
            onCustomerUpdated={(updatedCustomer, newContactId) => {
              setCustomers((current) => current.map((customer) => customer.id === updatedCustomer.id ? { ...customer, ...updatedCustomer } : customer));
              setCustomerContactId(newContactId);
            }}
          />
        )}

        {currentStep === 1 && !templateMode && !conversionMode && (
          <NewOrderPartEntryChooser
            mode={partEntryMode}
            persistentSelection
            existingDescription="Search every saved part, regardless of customer or business."
            onChoose={setPartEntryMode}
          />
        )}

        {currentStep === 1 && !templateMode && !conversionMode && partEntryMode === 'drawing' && (
          <NewOrderDrawingEntryPanel
            useLegacyReader={legacyDrawingReader}
            api={currentDrawingReader}
            business={attachmentBusiness}
            customerName={customers.find((customer) => customer.id === customerId)?.name ?? ''}
            draftReference={draftAttachmentReference}
            materials={materials}
            onContinueLegacy={applyImportedDrawingParts}
            onContinueV2={applyImportedDrawingParts}
            onSwitchToLegacy={() => setLegacyDrawingReader(true)}
            onSwitchToManual={() => setPartEntryMode('manual')}
            onCreateMaterial={createDrawingMaterial}
          />
        )}

        {currentStep === 1 && !templateMode && !conversionMode && partEntryMode === 'existing' && (
          <CustomerPartPicker
            customerId={customerId}
            business={business}
            onAddParts={addPreexistingOrderParts}
          />
        )}

        {currentStep === 1 && (templateMode || conversionMode || partEntryMode === 'manual') && (
          <NewOrderPartsEditor
            mode={templateMode ? 'template' : conversionMode ? 'conversion' : 'direct'}
            parts={parts}
            activePartKey={activePartKey}
            materials={materials}
            availableItems={availableItems}
            availableItemsById={availableItemsById}
            onSelectPart={setActivePartKey}
            onAddPart={addPartRow}
            onImportMore={() => setPartEntryMode('drawing')}
            onRemovePart={removePart}
            onUpdatePart={updatePart}
            onAddAddon={addAddonSelection}
            onUpdateAddon={updateAddonSelection}
            onRemoveAddon={removeAddonSelection}
            onMoveAddon={moveAddonSelection}
          />
        )}

        {currentStep === 2 && (
          <>

            <NewOrderReviewSummaryCards
              parts={parts}
              pricing={partPricing}
              addonLaborSubtotalCents={addonLaborSubtotalCents}
              partPricingTotalCents={partPricingTotalCents}
              totalEstimateCents={totalEstimateCents}
              onPricingChange={(partKey, patch) => setPartPricing((current) => current.map((entry) => entry.partKey === partKey ? { ...entry, ...patch } : entry))}
            />

            <NewOrderAttachmentsCard
              mode={templateMode ? 'template' : conversionMode ? 'conversion' : 'direct'}
              templateOrderAttachments={templateOrderAttachments}
              templatePartAttachmentEntries={templatePartAttachmentEntries}
              attachments={attachments}
              attachmentBusiness={attachmentBusiness}
              attachmentPathPreview={attachmentPathPreview}
              onAttachmentBusinessChange={setAttachmentBusiness}
              onAdd={addAttachmentRow}
              onRemove={removeAttachment}
              onUpdate={updateAttachment}
              onUrlChange={handleAttachmentUrlChange}
              onFile={(index, files) => void handleAttachmentFile(index, files)}
            />

            <NewOrderLaunchNotesCard
              templateMode={templateMode}
              conversionMode={conversionMode}
              checklistOptions={orderChecklistAddons}
              selectedIds={selectedAddonIds}
              notes={notes}
              onSelectedIdsChange={setSelectedAddonIds}
              onNotesChange={setNotes}
            />

            <NewOrderSubmitCard
              submitting={loading}
              disabled={repeatTemplateLoading || (templateMode && !repeatTemplate)}
              message={message}
              createdOrderId={createdOrderId}
              onViewOrder={() => createdOrderId && router.push(`/orders/${createdOrderId}`)}
              onPrintOrder={handlePrintNewOrder}
              onBackToOrders={() => router.push('/')}
              onCancel={() => void cancelOrderEntry()}
            />
          </>
        )}

        <NewOrderWizardNavigation
          currentStep={currentStep}
          stepCount={steps.length}
          nextDisabled={(templateMode && !repeatTemplate) || (currentStep === 1 && !templateMode && !conversionMode && partEntryMode !== 'manual')}
          onBack={() => selectStep(Math.max(currentStep - 1, 0))}
          onNext={() => selectStep(Math.min(currentStep + 1, steps.length - 1))}
        />
        </fieldset>
      </form>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading order form…</div>}>
      <NewOrderRoute />
    </React.Suspense>
  );
}

function NewOrderRoute() {
  const params = useSearchParams();
  return <NewOrderForm key={orderDraftTarget(params.get('templateId'), params.get('quoteId')).key} />;
}

