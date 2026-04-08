"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  ListChecks,
  PauseCircle,
  Play,
  Square,
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
import { PartBomTab } from './PartBomTab';

const PART_TABS = ['overview', 'notes', 'full-files', 'bom', 'checklist', 'log'] as const;
const PART_ATTACHMENT_KINDS = ['DWG', 'STEP', 'PDF', 'PO', 'PRINT', 'IMAGE', 'OTHER'] as const;

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
  activeOrderHref: string | null;
  elapsedSeconds: number;
};

type SelectOption = { id: string; name: string };

const formatDuration = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const statusBadgeStyles: Record<string, string> = {
  RECEIVED: 'bg-primary/10 text-primary',
  COMPLETE: 'bg-emerald-500/15 text-emerald-200',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-200',
  CLOSED: 'bg-slate-500/20 text-slate-200',
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
  const [canEditOrderStatus, setCanEditOrderStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState<'RECEIVED' | 'IN_PROGRESS' | 'COMPLETE' | 'CLOSED'>('RECEIVED');
  const [statusReason, setStatusReason] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [partEvents, setPartEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [activeEntries, setActiveEntries] = useState<any[]>([]);
  const [activePart, setActivePart] = useState<any | null>(null);
  const [selectedTimerDepartmentId, setSelectedTimerDepartmentId] = useState<string>('');
  const [partTotals, setPartTotals] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [conflictState, setConflictState] = useState<ConflictState>({
    open: false,
    activeEntry: null,
    activeOrder: null,
    activePart: null,
    activeOrderHref: null,
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
  const [editMode, setEditMode] = useState(false);
  const [savingOrderDetails, setSavingOrderDetails] = useState(false);
  const [savingPartDetails, setSavingPartDetails] = useState(false);
  const [orderDraft, setOrderDraft] = useState({
    customerId: '',
    receivedDate: '',
    dueDate: '',
    priority: 'NORMAL',
    vendorId: '',
    poNumber: '',
    assignedMachinistId: '',
    materialNeeded: false,
    materialOrdered: false,
    modelIncluded: false,
  });
  const [partDraft, setPartDraft] = useState({
    partNumber: '',
    quantity: 1,
    materialId: '',
    stockSize: '',
    cutLength: '',
    notes: '',
  });
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [vendors, setVendors] = useState<SelectOption[]>([]);
  const [machinists, setMachinists] = useState<SelectOption[]>([]);
  const [materials, setMaterials] = useState<SelectOption[]>([]);

  const parts = useMemo(() => (Array.isArray(item?.parts) ? item.parts : []), [item?.parts]);
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

  const checklistByDepartment = useMemo(() => {
    const groups = new Map<string, { departmentId: string | null; departmentName: string; entries: any[] }>();
    selectedChecklist.forEach((entry: any) => {
      const departmentId = entry.departmentId ?? null;
      const departmentName = entry.department?.name || (departmentId ? `Department ${departmentId}` : 'Unassigned Department');
      const key = departmentId ?? '__none__';
      if (!groups.has(key)) {
        groups.set(key, { departmentId, departmentName, entries: [] });
      }
      groups.get(key)?.entries.push(entry);
    });
    return Array.from(groups.values());
  }, [selectedChecklist]);

  const timerDepartments = useMemo(() => {
    const entries = Array.isArray(item?.checklist) ? item.checklist : [];
    const groups = new Map<string, { id: string; name: string }>();
    entries.forEach((entry: any) => {
      const departmentId = entry?.departmentId;
      if (!departmentId) return;
      const name = String(entry?.department?.name ?? '').trim();
      if (!name || name.toLowerCase() === 'shipping') return;
      if (!groups.has(departmentId)) {
        groups.set(departmentId, { id: departmentId, name });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [item?.checklist]);

  const manualMoveDepartments = useMemo(() => {
    const entries = Array.isArray(item?.checklist) ? item.checklist : [];
    const groups = new Map<string, { id: string; name: string }>();
    entries.forEach((entry: any) => {
      const departmentId = entry?.departmentId;
      if (!departmentId) return;
      const name = String(entry?.department?.name ?? '').trim() || `Department ${departmentId}`;
      if (!groups.has(departmentId)) {
        groups.set(departmentId, { id: departmentId, name });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [item?.checklist]);

  const selectedPartDepartmentHistory = useMemo(() => {
    if (!selectedPartId) return [];
    const entries = Array.isArray(item?.timeEntries) ? item.timeEntries : [];
    const filtered = entries.filter((entry: any) => entry.partId === selectedPartId && entry.endedAt);
    const grouped = new Map<string, { departmentId: string | null; departmentName: string; totalSeconds: number; entries: any[] }>();
    filtered.forEach((entry: any) => {
      const started = new Date(entry.startedAt).getTime();
      const ended = new Date(entry.endedAt).getTime();
      if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return;
      const seconds = Math.floor((ended - started) / 1000);
      const departmentId = entry.departmentId ?? null;
      const departmentName = entry.department?.name ?? (departmentId ? `Department ${departmentId}` : 'Unassigned');
      const key = departmentId ?? '__none__';
      if (!grouped.has(key)) {
        grouped.set(key, { departmentId, departmentName, totalSeconds: 0, entries: [] });
      }
      const group = grouped.get(key)!;
      group.totalSeconds += seconds;
      group.entries.push({ ...entry, durationSeconds: seconds });
    });
    return Array.from(grouped.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [item?.timeEntries, selectedPartId]);

  const partManualAdjustments = useMemo(() => {
    const all = Array.isArray((item as any)?.partTimeAdjustments) ? (item as any).partTimeAdjustments : [];
    return all.filter((adjustment: any) => adjustment.partId === selectedPartId);
  }, [item, selectedPartId]);

  const manualPartTotals = useMemo(() => {
    const all = Array.isArray((item as any)?.partTimeAdjustments) ? (item as any).partTimeAdjustments : [];
    return all.reduce((acc: Record<string, number>, adjustment: any) => {
      if (!adjustment?.partId) return acc;
      const seconds = Number(adjustment.seconds ?? 0);
      if (!Number.isFinite(seconds) || seconds <= 0) return acc;
      acc[adjustment.partId] = (acc[adjustment.partId] ?? 0) + Math.floor(seconds);
      return acc;
    }, {});
  }, [item]);

  const selectedAttachments = useMemo(() => {
    if (!selectedPartId) return [];
    const attachments = Array.isArray(item?.partAttachments) ? item.partAttachments : [];
    return attachments.filter((attachment: any) => attachment.partId === selectedPartId);
  }, [item?.partAttachments, selectedPartId]);

  const fullOrderFiles = useMemo(() => {
    const orderAttachments = Array.isArray(item?.attachments) ? item.attachments : [];
    const partAttachments = Array.isArray(item?.partAttachments) ? item.partAttachments : [];
    const partNumberById = new Map(parts.map((part: any) => [part.id, part.partNumber || 'Part']));

    const merged = [
      ...orderAttachments.map((attachment: any) => ({
        ...attachment,
        source: 'ORDER',
        sourceLabel: 'Order file',
        partNumber: null,
      })),
      ...partAttachments.map((attachment: any) => ({
        ...attachment,
        source: 'PART',
        sourceLabel: 'Part file',
        partNumber: partNumberById.get(attachment.partId) ?? null,
      })),
    ];

    return merged.sort((a: any, b: any) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [item?.attachments, item?.partAttachments, parts]);

  const visibleTabs = useMemo(
    () => PART_TABS.filter((tab) => (tab === 'full-files' ? canEditParts : true)),
    [canEditParts]
  );

  const selectedActiveEntry = useMemo(
    () =>
      activeEntries.find(
        (entry: any) =>
          entry?.partId === selectedPartId &&
          (selectedTimerDepartmentId ? entry?.departmentId === selectedTimerDepartmentId : true)
      ) ?? null,
    [activeEntries, selectedPartId, selectedTimerDepartmentId]
  );

  const lastPartEvent = useMemo(() => {
    if (!partEvents.length) return null;
    return partEvents[0] ?? null;
  }, [partEvents]);

  useEffect(() => {
    const interval = activeEntries.length ? window.setInterval(() => setNowMs(Date.now()), 1000) : null;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [activeEntries.length]);

  const load = React.useCallback(async () => {
    if (!id) return null;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
      setCanEditParts(Boolean(data?.permissions?.canEditParts));
      setCanEditOrderStatus(Boolean(data?.permissions?.canEditOrderStatus));
      setStatusDraft((data?.item?.status ?? 'RECEIVED') as 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETE' | 'CLOSED');
      setStatusError(null);
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
    if (!id || !selectedPartId) return false;
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
      setActiveEntries(Array.isArray(data.activeEntries) ? data.activeEntries : []);
      setActivePart(data.activePart ?? null);
      setPartTotals(data.totalsSeconds ?? {});
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
    if (!item) return;
    setOrderDraft({
      customerId: item.customerId ?? '',
      receivedDate: item.receivedDate ? String(item.receivedDate).slice(0, 10) : '',
      dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
      priority: item.priority ?? 'NORMAL',
      vendorId: item.vendorId ?? '',
      poNumber: item.poNumber ?? '',
      assignedMachinistId: item.assignedMachinistId ?? '',
      materialNeeded: Boolean(item.materialNeeded),
      materialOrdered: Boolean(item.materialOrdered),
      modelIncluded: Boolean(item.modelIncluded),
    });
  }, [item]);

  useEffect(() => {
    if (!selectedPart) return;
    setPartDraft({
      partNumber: selectedPart.partNumber ?? '',
      quantity: Number(selectedPart.quantity ?? 1),
      materialId: selectedPart.materialId ?? '',
      stockSize: selectedPart.stockSize ?? '',
      cutLength: selectedPart.cutLength ?? '',
      notes: selectedPart.notes ?? '',
    });
  }, [selectedPart]);

  useEffect(() => {
    if (!editMode || !canEditParts) return;

    const loadOptions = async () => {
      const fetchOptions = async (url: string): Promise<SelectOption[]> => {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        return items
          .map((entry: any) => ({
            id: String(entry.id ?? ''),
            name: String(entry.name ?? entry.email ?? 'Unnamed'),
          }))
          .filter((entry: SelectOption) => entry.id.length > 0);
      };

      const [loadedCustomers, loadedVendors, loadedMachinists, loadedMaterials] = await Promise.all([
        fetchOptions('/api/admin/customers?take=200'),
        fetchOptions('/api/admin/vendors?take=200'),
        fetchOptions('/api/admin/users?role=MACHINIST&take=200'),
        fetchOptions('/api/admin/materials?take=200'),
      ]);

      setCustomers(loadedCustomers);
      setVendors(loadedVendors);
      setMachinists(loadedMachinists);
      setMaterials(loadedMaterials);
    };

    void loadOptions();
  }, [editMode, canEditParts]);

  useEffect(() => {
    refreshTimerSummary();
  }, [refreshTimerSummary]);

  useEffect(() => {
    loadPartEvents();
  }, [loadPartEvents]);

  const handleStart = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;
    if (!selectedTimerDepartmentId) {
      setTimerError('Please choose a department before starting a timer.');
      return false;
    }
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, partId: selectedPartId, departmentId: selectedTimerDepartmentId, operation: 'Part Work' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setTimerError(typeof data?.error === 'string' ? data.error : 'Failed to start timer.');
        await refreshTimerSummary();
        return false;
      }
      await refreshTimerSummary();
      await loadPartEvents();
      setSelectedTimerDepartmentId('');
      return true;
    } catch {
      setTimerError('Failed to start timer.');
      return false;
    } finally {
      setTimerSaving(false);
    }
  };

  const handlePause = async (entryId?: string): Promise<boolean> => {
    if (!entryId) return false;
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/pause', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) throw res;
      await refreshTimerSummary();
      await loadPartEvents();
      return true;
    } catch {
      setTimerError('Failed to pause timer.');
      return false;
    } finally {
      setTimerSaving(false);
    }
  };

  const handleActivateSelectedPart = async (): Promise<boolean> => {
    return handleStart();
  };

  const handleFinish = async (entryId?: string): Promise<boolean> => {
    if (!entryId) return false;
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch('/api/timer/finish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) throw res;
      await load();
      await refreshTimerSummary();
      await loadPartEvents();
      return true;
    } catch {
      setTimerError('Failed to finish timer.');
      return false;
    } finally {
      setTimerSaving(false);
    }
  };

  const handleSubmitDepartmentComplete = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;

    const currentDepartmentId = selectedPart?.currentDepartmentId ?? '';
    const currentDepartment = manualMoveDepartments.find((department) => department.id === currentDepartmentId) ?? null;
    const optionsLabel = manualMoveDepartments
      .map((department) => `${department.name} [${department.id}]`)
      .join('\n');

    const destinationPrompt = window.prompt(
      `Current department: ${currentDepartment?.name ?? currentDepartmentId || 'Unassigned'}

Choose destination department by entering the department ID:
${optionsLabel}`,
      '',
    );
    if (destinationPrompt === null) return false;
    const destinationDepartmentId = destinationPrompt.trim();
    if (!destinationDepartmentId) {
      setTimerError('Destination department is required.');
      return false;
    }

    const destinationDepartment = manualMoveDepartments.find((department) => department.id === destinationDepartmentId);
    if (!destinationDepartment) {
      setTimerError('Select a valid destination department ID from the list.');
      return false;
    }

    if (destinationDepartmentId === currentDepartmentId) {
      setTimerError('Destination department must be different from current department.');
      return false;
    }

    const moveNote = window.prompt('Enter move note (required):')?.trim() || '';
    if (!moveNote) {
      setTimerError('A move note is required.');
      return false;
    }

    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch(`/api/orders/${id}/parts/assign-department`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          partId: selectedPartId,
          departmentId: destinationDepartmentId,
          reasonCode: 'MANUAL_MOVE',
          reasonText: moveNote,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to move part to department.');
      }

      await load();
      await refreshTimerSummary();
      await loadPartEvents();
      toast.push(`Part moved to ${destinationDepartment.name}.`, 'success');
      return true;
    } catch (err: any) {
      const message = err?.message || 'Failed to move part to department.';
      setTimerError(message);
      return false;
    } finally {
      setTimerSaving(false);
    }
  };


  const handleCompleteSelectedPart = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;
    const confirmed = window.confirm('Mark selected part complete? This should only be done in Shipping after all department checklists are complete.');
    if (!confirmed) return false;

    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to complete part.');
      }

      await load();
      await refreshTimerSummary();
      await loadPartEvents();
      toast.push('Part marked complete.', 'success');
      return true;
    } catch (err: any) {
      const message = err?.message || 'Failed to complete part.';
      setTimerError(message);
      return false;
    } finally {
      setTimerSaving(false);
    }
  };


  const handleConflictAction = async (action: 'pause' | 'finish') => {
    setConflictState((prev) => ({ ...prev, open: false }));
    const entryId = conflictState.activeEntry?.id as string | undefined;
    const closedCurrent = action === 'pause' ? await handlePause(entryId) : await handleFinish(entryId);
    if (!closedCurrent) return;
    await handleActivateSelectedPart();
  };


  const handleSaveStatus = async () => {
    if (!id || !canEditOrderStatus) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: statusDraft, reason: statusReason }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to update order status.');
      }
      setStatusReason('');
      await load();
      toast.push('Order status updated.', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to update order status.';
      setStatusError(message);
      toast.push(message, 'error');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveOrderDetails = async () => {
    if (!id || !canEditParts) return;
    setSavingOrderDetails(true);
    try {
      const payload: Record<string, unknown> = {
        customerId: orderDraft.customerId || undefined,
        receivedDate: orderDraft.receivedDate || undefined,
        dueDate: orderDraft.dueDate || undefined,
        priority: orderDraft.priority,
        vendorId: orderDraft.vendorId || '',
        poNumber: orderDraft.poNumber || '',
        assignedMachinistId: orderDraft.assignedMachinistId || '',
        materialNeeded: orderDraft.materialNeeded,
        materialOrdered: orderDraft.materialOrdered,
        modelIncluded: orderDraft.modelIncluded,
      };
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to update order details.');
      }
      await load();
      toast.push('Order details updated.', 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to update order details.', 'error');
    } finally {
      setSavingOrderDetails(false);
    }
  };

  const handleSavePartDetails = async () => {
    if (!id || !selectedPartId || !canEditParts) return;
    setSavingPartDetails(true);
    try {
      const payload = {
        partNumber: partDraft.partNumber,
        quantity: Number(partDraft.quantity),
        materialId: partDraft.materialId || null,
        stockSize: partDraft.stockSize || null,
        cutLength: partDraft.cutLength || null,
        notes: partDraft.notes || null,
      };
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to update part.');
      }
      await load();
      toast.push('Part updated.', 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to update part.', 'error');
    } finally {
      setSavingPartDetails(false);
    }
  };

  const handleAddPart = async () => {
    if (!id || !canEditParts) return;
    try {
      const payload = {
        partNumber: `NEW-PART-${(parts.length + 1).toString().padStart(2, '0')}`,
        quantity: 1,
      };
      const res = await fetch(`/api/orders/${id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to add part.');
      }
      await load();
      toast.push('Part added. Update fields as needed.', 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to add part.', 'error');
    }
  };

  const handleDeleteSelectedPart = async () => {
    if (!id || !selectedPartId || !canEditParts) return;
    const confirmed = window.confirm('Delete selected part? This cannot be undone.');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to delete part.');
      }
      await load();
      toast.push('Part deleted.', 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to delete part.', 'error');
    }
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

  const postChecklistToggle = async (
    entry: any,
    checked: boolean,
    extra: { reasonCode?: string; reasonText?: string } = {},
  ) => {
    const res = await fetch(`/api/orders/${id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklistId: entry.id,
        checked,
        partId: selectedPartId,
        ...extra,
      }),
      credentials: 'include',
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const message = typeof errorBody?.error === 'string' ? errorBody.error : 'Failed to toggle checklist item.';
      throw new Error(message);
    }
  };

  const handleChecklistToggle = async (entry: any, checked: boolean) => {
    if (!selectedPartId) return;
    setChecklistError(null);

    try {
      await postChecklistToggle(entry, checked);
      await load();
      await loadPartEvents();
    } catch (err: any) {
      const message = err?.message || 'Failed to toggle checklist item.';
      setChecklistError(message);
      toast.push(message, 'error');
    }
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
  const statusLabel = item.status
    ? String(item.status)
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
    : 'Unknown';
  const activeOnSelected = Boolean(selectedActiveEntry);
  const selectedPartTimerSeconds = selectedPartId ? partTotals[selectedPartId] ?? 0 : 0;
  const selectedPartManualSeconds = selectedPartId ? manualPartTotals[selectedPartId] ?? 0 : 0;
  const selectedPartStoredSeconds = selectedPartTimerSeconds + selectedPartManualSeconds;
  const selectedActiveElapsedSeconds = selectedActiveEntry?.startedAt
    ? Math.max(0, Math.floor((nowMs - new Date(selectedActiveEntry.startedAt).getTime()) / 1000))
    : 0;
  const selectedPartElapsedSeconds = activeOnSelected ? selectedPartStoredSeconds + selectedActiveElapsedSeconds : selectedPartStoredSeconds;
  const hasActiveEntry = activeEntries.length > 0;
  const startButtonLabel = 'Start selected part';
  const startHelperLabel = 'Starts a timer on the selected part for the selected department. Department moves are manual only.';
  const selectedCurrentDepartment = manualMoveDepartments.find((department) => department.id === selectedPart?.currentDepartmentId) ?? null;
  const canMarkPartComplete = (selectedCurrentDepartment?.name ?? '').trim().toLowerCase() === 'shipping';

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
            {conflictState.activeOrderHref ? (
              <p>
                Manage it here:{' '}
                <Link href={conflictState.activeOrderHref} className="font-medium text-primary underline-offset-2 hover:underline">
                  Open active timer context
                </Link>
              </p>
            ) : null}
            <p>
              Confirming switch will close that timer, then activate{' '}
              <span className="font-medium text-foreground">{selectedPart?.partNumber || 'the selected part'}</span>.
            </p>
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
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Work</div>
                  <div className="text-sm font-medium text-foreground">
                    {selectedPart?.partNumber || 'No part selected'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPartId ? `Elapsed ${formatDuration(selectedPartElapsedSeconds)}` : 'No part selected'}
                  </div>
                </div>
                <Badge className={hasActiveEntry ? 'bg-emerald-500/15 text-emerald-200' : 'bg-muted text-foreground'}>
                  {activeOnSelected ? 'Timer running for selected department' : hasActiveEntry ? 'Other department timers running' : 'Timer paused/stopped'}
                </Badge>
              </div>

              <div className="grid gap-2">
                <Select value={selectedTimerDepartmentId} onValueChange={setSelectedTimerDepartmentId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Choose timer department" />
                  </SelectTrigger>
                  <SelectContent>
                    {timerDepartments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedPartId || timerSaving || activeOnSelected || !selectedTimerDepartmentId}
                  onClick={handleActivateSelectedPart}
                  className="justify-start gap-2"
                >
                  <Play className="h-4 w-4" />
                  {startButtonLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!selectedActiveEntry || timerSaving}
                  onClick={() => void handlePause(selectedActiveEntry?.id)}
                  className="justify-start gap-2"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause active timer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!selectedActiveEntry || timerSaving}
                  onClick={() => void handleFinish(selectedActiveEntry?.id)}
                  className="justify-start gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop timer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!selectedPartId || timerSaving || activeOnSelected}
                  onClick={handleSubmitDepartmentComplete}
                  className="justify-start gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Move part to department
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!selectedPartId || timerSaving || !canMarkPartComplete}
                  onClick={handleCompleteSelectedPart}
                  className="justify-start gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark part complete (Shipping)
                </Button>
              </div>

              <div className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5" />
                  <span>{startHelperLabel}</span>
                </div>
                <div>
                  {lastPartEvent ? (
                    <span>
                      Last action: <span className="font-medium text-foreground">{lastPartEvent.message}</span> ·{' '}
                      {new Date(lastPartEvent.createdAt).toLocaleString()}
                    </span>
                  ) : (
                    <span>Last action: none yet for this part.</span>
                  )}
                </div>
              </div>
            </div>
            {timerError ? (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {timerError}
              </div>
            ) : null}
            {selectedPartId ? (
              <div className="mt-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Total time:</span> {formatDuration(selectedPartStoredSeconds)}</div>
                <div>Timer time: {formatDuration(selectedPartTimerSeconds)}</div>
                <div>Manual added time: {formatDuration(selectedPartManualSeconds)}</div>
                {partManualAdjustments.length ? (
                  <div className="mt-2 space-y-1">
                    {partManualAdjustments.map((adjustment: any) => (
                      <div key={adjustment.id}>
                        +{formatDuration(Number(adjustment.seconds ?? 0))} — {adjustment.note}
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedPartDepartmentHistory.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Department history totals</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {selectedPartDepartmentHistory.map((group) => (
                        <div key={group.departmentId ?? '__none__'} className="rounded border border-border/60 bg-background/70 p-2">
                          <div className="text-[11px] text-muted-foreground">{group.departmentName}</div>
                          <div className="text-sm font-semibold text-foreground">{formatDuration(group.totalSeconds)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {selectedPartDepartmentHistory.map((group) => (
                        <div key={`${group.departmentId ?? '__none__'}_rows`} className="rounded border border-border/50 bg-background/50 p-2">
                          <div className="mb-1 text-[11px] font-medium text-foreground">{group.departmentName}</div>
                          {group.entries.slice(0, 5).map((entry: any) => (
                            <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>{new Date(entry.startedAt).toLocaleString()}</span>
                              <span className="font-medium text-foreground">{formatDuration(entry.durationSeconds)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                const totalSeconds = (partTotals[part.id] ?? 0) + (manualPartTotals[part.id] ?? 0);
                const status = part.status || 'IN_PROGRESS';
                const latestMetaRaw = part?.partEvents?.[0]?.meta;
                const latestMeta = typeof latestMetaRaw === 'string' ? (() => { try { return JSON.parse(latestMetaRaw); } catch { return null; } })() : latestMetaRaw;
                const flagged = latestMeta?.flag === true;
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
                        {flagged ? <Badge variant="destructive" title={typeof latestMeta?.reasonText === 'string' ? latestMeta.reasonText : 'Rework / manual backward move'}>REWORK</Badge> : null}
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(totalSeconds)}
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
              <div className="flex items-center gap-2">
                {canEditParts ? (
                  <Button type="button" variant={editMode ? 'secondary' : 'outline'} size="sm" onClick={() => setEditMode((prev) => !prev)}>
                    {editMode ? 'Exit edit mode' : 'Edit order'}
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href="/">Exit Order</Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={statusBadgeStyles[item.status || 'RECEIVED'] || 'bg-primary/10 text-primary'}>{statusLabel}</Badge>
                <span className="text-sm text-muted-foreground">Due {dueDateLabel}</span>
              </div>
              {canEditOrderStatus ? (
                <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_auto] lg:items-end">
                  <div className="grid gap-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Order status</Label>
                    <Select
                      value={statusDraft}
                      onValueChange={(value) => {
                        setStatusDraft(value as 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETE' | 'CLOSED');
                        setStatusError(null);
                      }}
                    >
                      <SelectTrigger className="border-border/60 bg-background/80 text-left">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RECEIVED">Received</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="COMPLETE">Complete</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Admin reason</Label>
                    <Textarea
                      rows={2}
                      value={statusReason}
                      onChange={(e) => {
                        setStatusReason(e.target.value);
                        setStatusError(null);
                      }}
                      placeholder="Why are you changing the order status?"
                    />
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    <Button size="sm" onClick={handleSaveStatus} disabled={statusSaving}>
                      {statusSaving ? 'Saving…' : 'Save status'}
                    </Button>
                    <p className="max-w-xs text-xs text-muted-foreground lg:text-right">
                      Admin override. Shop-floor part activity will still auto-sync this order later.
                    </p>
                  </div>
                </div>
              ) : null}
              {statusError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {statusError}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap rounded-md bg-muted/20 p-1">
              {visibleTabs.map((tab) => {
                const label =
                  tab === 'overview'
                    ? 'Overview'
                    : tab === 'notes'
                      ? 'Notes & Files'
                      : tab === 'full-files'
                        ? 'Full Order Files'
                      : tab === 'checklist'
                        ? 'To-do / Checklist'
                        : tab === 'log'
                          ? 'Log'
                          : 'BOM';
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
                {editMode && canEditParts ? (
                  <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Edit order details</p>
                      <Button size="sm" onClick={handleSaveOrderDetails} disabled={savingOrderDetails}>
                        {savingOrderDetails ? 'Saving…' : 'Save order'}
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Customer</Label>
                        <Select value={orderDraft.customerId || '__none__'} onValueChange={(value) => setOrderDraft((prev) => ({ ...prev, customerId: value === '__none__' ? '' : value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select customer</SelectItem>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Vendor</Label>
                        <Select value={orderDraft.vendorId || '__none__'} onValueChange={(value) => setOrderDraft((prev) => ({ ...prev, vendorId: value === '__none__' ? '' : value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No vendor</SelectItem>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Received date</Label>
                        <Input type="date" value={orderDraft.receivedDate} onChange={(e) => setOrderDraft((prev) => ({ ...prev, receivedDate: e.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Due date</Label>
                        <Input type="date" value={orderDraft.dueDate} onChange={(e) => setOrderDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Priority</Label>
                        <Select value={orderDraft.priority} onValueChange={(value) => setOrderDraft((prev) => ({ ...prev, priority: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">LOW</SelectItem>
                            <SelectItem value="NORMAL">NORMAL</SelectItem>
                            <SelectItem value="RUSH">RUSH</SelectItem>
                            <SelectItem value="HOT">HOT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Assigned machinist</Label>
                        <Select value={orderDraft.assignedMachinistId || '__none__'} onValueChange={(value) => setOrderDraft((prev) => ({ ...prev, assignedMachinistId: value === '__none__' ? '' : value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {machinists.map((machinist) => (
                              <SelectItem key={machinist.id} value={machinist.id}>{machinist.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>PO Number</Label>
                        <Input value={orderDraft.poNumber} onChange={(e) => setOrderDraft((prev) => ({ ...prev, poNumber: e.target.value }))} />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={orderDraft.materialNeeded} onCheckedChange={(checked) => setOrderDraft((prev) => ({ ...prev, materialNeeded: checked === true }))} />
                        Material needed
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={orderDraft.materialOrdered} onCheckedChange={(checked) => setOrderDraft((prev) => ({ ...prev, materialOrdered: checked === true }))} />
                        Material ordered
                      </label>
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <Checkbox checked={orderDraft.modelIncluded} onCheckedChange={(checked) => setOrderDraft((prev) => ({ ...prev, modelIncluded: checked === true }))} />
                        Model included
                      </label>
                    </div>
                    {selectedPart ? (
                      <div className="space-y-3 rounded-md border border-border/50 bg-background/40 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">Edit selected part</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={handleAddPart}>Add part</Button>
                            <Button size="sm" variant="destructive" onClick={handleDeleteSelectedPart} disabled={parts.length <= 1}>Delete part</Button>
                            <Button size="sm" onClick={handleSavePartDetails} disabled={savingPartDetails}>
                              {savingPartDetails ? 'Saving…' : 'Save part'}
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Part number</Label>
                            <Input value={partDraft.partNumber} onChange={(e) => setPartDraft((prev) => ({ ...prev, partNumber: e.target.value }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Quantity</Label>
                            <Input type="number" min={1} value={partDraft.quantity} onChange={(e) => setPartDraft((prev) => ({ ...prev, quantity: Number(e.target.value || 1) }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Material</Label>
                            <Select value={partDraft.materialId || '__none__'} onValueChange={(value) => setPartDraft((prev) => ({ ...prev, materialId: value === '__none__' ? '' : value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">No material</SelectItem>
                                {materials.map((material) => (
                                  <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Stock size</Label>
                            <Input value={partDraft.stockSize} onChange={(e) => setPartDraft((prev) => ({ ...prev, stockSize: e.target.value }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Cut length</Label>
                            <Input value={partDraft.cutLength} onChange={(e) => setPartDraft((prev) => ({ ...prev, cutLength: e.target.value }))} />
                          </div>
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Part notes</Label>
                            <Textarea rows={3} value={partDraft.notes} onChange={(e) => setPartDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                    <FileText className="h-4 w-4 text-muted-foreground" /> Files & print drawings
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
                      <p className="text-sm text-muted-foreground">No files yet for this part. Upload a file with type <span className="font-medium text-foreground">PRINT</span> to make it the preferred BOM analyzer source.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Print image slot for BOM analyzer</p>
                    <p className="mt-1">Set file type to <span className="font-medium text-foreground">PRINT</span> for drawings/photos you want the BOM tab to auto-prioritize.</p>
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

            {activeTab === 'full-files' && canEditParts && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                  Full Order Files is admin-only and includes order-level + part-level files for this order.
                </div>
                <div className="space-y-3">
                  {fullOrderFiles.length ? (
                    fullOrderFiles.map((attachment: any) => {
                      const href = attachment.storagePath ? `/attachments/${attachment.storagePath}` : attachment.url;
                      return (
                        <div key={`${attachment.source}-${attachment.id}`} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{attachment.label || 'Attachment'}</p>
                            <Badge variant="outline">{attachment.sourceLabel}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {attachment.partNumber ? `Part: ${attachment.partNumber} · ` : null}
                            {attachment.mimeType || 'Unknown type'} · {new Date(attachment.createdAt).toLocaleString()}
                          </div>
                          {attachment.storagePath ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              <code>{attachment.storagePath}</code>
                            </div>
                          ) : null}
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
                              Open file
                            </a>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No files found on this order.</p>
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
                {checklistByDepartment.length ? (
                  checklistByDepartment.map((group) => (
                    <div key={group.departmentId ?? '__none__'} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.departmentName}</div>
                      {group.entries.map((entry: any) => {
                        const label = entry.charge?.name ?? entry.addon?.name ?? 'Checklist item';
                        return (
                          <label
                            key={entry.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={Boolean(entry.completed)}
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
                      })}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No checklist items for this part.</p>
                )}
              </div>
            )}

            {activeTab === 'bom' && selectedPartId && (
              <PartBomTab
                orderId={id}
                partId={selectedPartId}
                attachments={selectedAttachments}
              />
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
