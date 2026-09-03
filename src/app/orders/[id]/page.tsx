"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowRightLeft,
  CheckCircle2,
  PauseCircle,
  Play,
  Printer,
  Square,
  Timer,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PartBomTab } from './PartBomTab';
import { OrderHeaderEditor } from './OrderHeaderEditor';
import { PART_MATERIAL_STATUS_OPTIONS, SelectedPartEditor } from './SelectedPartEditor';
import { PartWorkerAssignmentsPanel } from './PartWorkerAssignmentsPanel';
import { OrderChecklistPanel } from './OrderChecklistPanel';
import { OrderActivityPanel } from './OrderActivityPanel';
import { FullOrderFilesPanel, PART_ATTACHMENT_KINDS, PartNotesAndFilesPanel } from './OrderFilesPanels';
import { PartInstructionsPanel, PartOverviewDetails } from './OrderOverviewPanels';
import { OrderTimerConsole } from './OrderTimerConsole';
import { OrderStatusChangeDialog } from './OrderStatusChangeDialog';
import { findNextDepartmentWithOpenChecklist } from '@/modules/orders/department-routing';

const PART_TABS = ['overview', 'notes', 'full-files', 'bom', 'checklist', 'log'] as const;
function formatPartMaterialStatus(value?: string | null) {
  return PART_MATERIAL_STATUS_OPTIONS.find(([status]) => status === value)?.[1] ?? 'Not reviewed';
}

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
type CustomerOption = SelectOption & {
  contacts: Array<{ id: string; name: string; email?: string | null; phone?: string | null }>;
};
type TeamUserOption = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
  kioskEnabled?: boolean | null;
  primaryDepartmentId?: string | null;
  primaryDepartment?: { id: string; name: string } | null;
};
type MoveDepartmentDialogState = {
  open: boolean;
  destinationDepartmentId: string;
  note: string;
  error: string | null;
};
type SubmitConfirmDialogState = {
  open: boolean;
  destinationDepartmentId: string;
  note: string;
  error: string | null;
};
type InstructionGatePendingAction =
  | { kind: 'timer-start' }
  | { kind: 'checklist-toggle'; entry: any; checked: boolean }
  | { kind: 'submit-department'; destinationDepartmentId: string; note: string };
type InstructionGateDialogState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  pendingAction: InstructionGatePendingAction | null;
  workerId: string;
};
type ChecklistPerformerDialogState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  entry: any | null;
  checked: boolean;
  performerId: string;
};
type KioskTimerDialogMode = 'start' | 'pause' | 'finish';
type KioskTimerDialogState = {
  open: boolean;
  mode: KioskTimerDialogMode;
  workerId: string;
  departmentId: string;
  pin: string;
  partId: string;
  loading: boolean;
  error: string | null;
  targetTimer: {
    userName: string;
    departmentName: string | null;
    partLabel: string | null;
  } | null;
  conflict: {
    activeEntry: any | null;
    activeOrder: any | null;
    activePart: any | null;
    elapsedSeconds: number;
  } | null;
};

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

type InstructionSection = {
  heading: string | null;
  items: string[];
};

const parseInstructionSections = (instructions: string): InstructionSection[] => {
  const blocks = instructions
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections = blocks
    .map((block) => {
      const rawLines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!rawLines.length) return null;

      const firstLine = rawLines[0];
      const hasHeading = firstLine.endsWith(':');
      const heading = hasHeading ? firstLine.slice(0, -1).trim() || null : null;
      const itemSource = hasHeading ? rawLines.slice(1) : rawLines;
      const items = itemSource
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);

      if (!items.length && heading) {
        return { heading, items: ['No details provided.'] };
      }
      if (!items.length) return null;

      return {
        heading,
        items,
      };
    })
    .filter(Boolean) as InstructionSection[];

  if (sections.length) return sections;
  const fallback = instructions.trim();
  return fallback ? [{ heading: null, items: [fallback] }] : [];
};

export default function OrderDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
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
  const [canUseTimerControls, setCanUseTimerControls] = useState(true);
  const [kioskSession, setKioskSession] = useState<any | null>(null);
  const [kioskSessionLoading, setKioskSessionLoading] = useState(false);
  const [partEvents, setPartEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [activeEntries, setActiveEntries] = useState<any[]>([]);
  const [activePart, setActivePart] = useState<any | null>(null);
  const [partActivity, setPartActivity] = useState<Record<string, { activeTimers: any[]; timeByUser: any[]; totalSeconds: number }>>({});
  const [selectedTimerDepartmentId, setSelectedTimerDepartmentId] = useState<string>('');
  const [selectedTimerWorkerId, setSelectedTimerWorkerId] = useState<string>('');
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
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [statusChangeDialog, setStatusChangeDialog] = useState({
    open: false,
    status: 'RECEIVED',
    reason: '',
    saving: false,
    error: null as string | null,
  });
  const [savingPartDetails, setSavingPartDetails] = useState(false);
  const [materialStatusSaving, setMaterialStatusSaving] = useState(false);
  const [orderDraft, setOrderDraft] = useState({
    business: '',
    customerId: '',
    customerContactId: '',
    receivedDate: '',
    dueDate: '',
    vendorId: '',
    poNumber: '',
    assignedMachinistId: '',
    materialNeeded: false,
    materialOrdered: false,
    modelIncluded: false,
  });
  const [partDraft, setPartDraft] = useState({
    partNumber: '',
    partName: '',
    quantity: 1,
    materialId: '',
    materialStatus: 'UNREVIEWED',
    procurementVendorId: '',
    inventoryLocation: '',
    materialNotes: '',
    stockSize: '',
    cutLength: '',
    finalPartLength: '',
    partWidth: '',
    partThickness: '',
    notes: '',
    workInstructions: '',
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [vendors, setVendors] = useState<SelectOption[]>([]);
  const [machinists, setMachinists] = useState<SelectOption[]>([]);
  const [materials, setMaterials] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUserOption[]>([]);
  const [assignmentUserId, setAssignmentUserId] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [moveDepartmentDialog, setMoveDepartmentDialog] = useState<MoveDepartmentDialogState>({
    open: false,
    destinationDepartmentId: '',
    note: '',
    error: null,
  });
  const [submitConfirmDialog, setSubmitConfirmDialog] = useState<SubmitConfirmDialogState>({
    open: false,
    destinationDepartmentId: '',
    note: '',
    error: null,
  });
  const [instructionGateDialog, setInstructionGateDialog] = useState<InstructionGateDialogState>({
    open: false,
    loading: false,
    error: null,
    pendingAction: null,
    workerId: '',
  });
  const [checklistPerformerDialog, setChecklistPerformerDialog] = useState<ChecklistPerformerDialogState>({
    open: false,
    loading: false,
    error: null,
    entry: null,
    checked: false,
    performerId: '',
  });
  const [showTimerDetails, setShowTimerDetails] = useState(false);
  const [repeatTemplateDialogOpen, setRepeatTemplateDialogOpen] = useState(false);
  const [repeatTemplateName, setRepeatTemplateName] = useState('');
  const [repeatTemplateSaving, setRepeatTemplateSaving] = useState(false);
  const [repeatTemplateError, setRepeatTemplateError] = useState<string | null>(null);
  const [savedRepeatTemplate, setSavedRepeatTemplate] = useState<{ id: string; name: string } | null>(null);
  const [kioskTimerDialog, setKioskTimerDialog] = useState<KioskTimerDialogState>({
    open: false,
    mode: 'start',
    workerId: '',
    departmentId: '',
    pin: '',
    partId: '',
    loading: false,
    error: null,
    targetTimer: null,
    conflict: null,
  });

  const parts = useMemo(() => (Array.isArray(item?.parts) ? item.parts : []), [item?.parts]);
  const partIdsParam = useMemo(() => parts.map((part: any) => part.id).filter(Boolean).join(','), [parts]);
  const selectedPart = useMemo(
    () => parts.find((part: any) => part?.id === selectedPartId) ?? null,
    [parts, selectedPartId]
  );
  const defaultRepeatTemplateName = useMemo(() => {
    const customerName = typeof item?.customer?.name === 'string' ? item.customer.name.trim() : 'Customer';
    const partNumber = typeof selectedPart?.partNumber === 'string' ? selectedPart.partNumber.trim() : 'Part';
    const partName = typeof selectedPart?.partName === 'string' ? selectedPart.partName.trim() : '';
    return `${customerName} - ${partNumber}${partName ? ` - ${partName}` : ''}`;
  }, [item?.customer?.name, selectedPart?.partName, selectedPart?.partNumber]);
  const currentUser = session?.user as any;
  const currentUserId = typeof currentUser?.id === 'string' ? currentUser.id : '';
  const currentUserName =
    (typeof currentUser?.name === 'string' && currentUser.name.trim()) ||
    (typeof currentUser?.email === 'string' && currentUser.email.trim()) ||
    currentUserId ||
    'Current user';
  const selectedPartInstructions = String(selectedPart?.workInstructions ?? '').trim();
  const selectedPartInstructionSections = useMemo(
    () => parseInstructionSections(selectedPartInstructions),
    [selectedPartInstructions],
  );
  const selectedPartInstructionsVersion = Math.max(1, Number(selectedPart?.instructionsVersion ?? 1));
  const selectedPartCurrentDepartmentId = selectedPart?.currentDepartmentId ?? null;
  const getInstructionReceiptForUserDepartment = (userId?: string | null, departmentId?: string | null) => {
    if (!selectedPartId || !userId || !departmentId) return null;
    const receipts = Array.isArray(selectedPart?.instructionReceipts) ? selectedPart.instructionReceipts : [];
    return (
      receipts.find(
        (receipt: any) =>
          receipt.userId === userId &&
          receipt.departmentId === departmentId &&
          Math.max(1, Number(receipt.instructionsVersion ?? 1)) === selectedPartInstructionsVersion,
      ) ?? null
    );
  };
  const selectedPartInstructionReceipt = getInstructionReceiptForUserDepartment(
    currentUserId,
    selectedPartCurrentDepartmentId,
  );
  const selectedPartRequiresInstructionGate = Boolean(selectedPartInstructions && selectedPartCurrentDepartmentId && !selectedPartInstructionReceipt);
  const selectedPartAssignments = useMemo(() => (Array.isArray(selectedPart?.assignments) ? selectedPart.assignments : []), [selectedPart?.assignments]);
  const assignedWorkerIds = useMemo(() => new Set(selectedPartAssignments.map((assignment: any) => assignment.userId)), [selectedPartAssignments]);
  const activeTeamUsers = useMemo(
    () =>
      teamUsers
        .filter((user) => user.active !== false && user.role !== 'VIEWER')
        .map((user) => ({
          ...user,
          name: user.name?.trim() || user.email?.trim() || user.id,
        })),
    [teamUsers],
  );
  const performerUsers = useMemo(() => {
    const users = [...activeTeamUsers];
    if (currentUserId && !users.some((user) => user.id === currentUserId)) {
      users.unshift({
        id: currentUserId,
        name: currentUserName,
        email: typeof currentUser?.email === 'string' ? currentUser.email : null,
        role: typeof currentUser?.role === 'string' ? currentUser.role : null,
        active: true,
      });
    }
    return users;
  }, [activeTeamUsers, currentUser, currentUserId, currentUserName]);
  const availableAssignmentUsers = useMemo(
    () => performerUsers.filter((user) => !assignedWorkerIds.has(user.id)),
    [assignedWorkerIds, performerUsers],
  );
  const timerWorkerOptions = useMemo(() => performerUsers, [performerUsers]);
  const kioskWorkers = useMemo(() => activeTeamUsers, [activeTeamUsers]);
  const selectedKioskWorker = useMemo(
    () => kioskWorkers.find((user) => user.id === kioskTimerDialog.workerId) ?? null,
    [kioskTimerDialog.workerId, kioskWorkers],
  );
  const selectedTimerWorker = useMemo(
    () => timerWorkerOptions.find((user) => user.id === selectedTimerWorkerId) ?? null,
    [selectedTimerWorkerId, timerWorkerOptions],
  );
  const selectedInstructionGateWorker = useMemo(
    () => timerWorkerOptions.find((user) => user.id === instructionGateDialog.workerId) ?? null,
    [instructionGateDialog.workerId, timerWorkerOptions],
  );
  const selectedChecklist = useMemo(() => {
    if (!selectedPartId) return [];
    const items = Array.isArray(item?.checklist) ? item.checklist : [];
    return items.filter((entry: any) => entry.isActive !== false && entry.partId === selectedPartId);
  }, [item?.checklist, selectedPartId]);

  const timerDepartments = useMemo(
    () => departments.filter((department) => department.name.trim().toLowerCase() !== 'shipping'),
    [departments]
  );

  const manualMoveDepartments = useMemo(() => departments, [departments]);
  const selectedCurrentDepartment = manualMoveDepartments.find((department) => department.id === selectedPart?.currentDepartmentId) ?? null;
  const instructionGateDepartmentId = !instructionGateDialog.pendingAction
    ? selectedPartCurrentDepartmentId
    : instructionGateDialog.pendingAction.kind === 'timer-start'
      ? selectedTimerDepartmentId || selectedPartCurrentDepartmentId
      : instructionGateDialog.pendingAction.kind === 'checklist-toggle'
        ? instructionGateDialog.pendingAction.entry?.departmentId ?? selectedPartCurrentDepartmentId
        : selectedPartCurrentDepartmentId;
  const instructionGateDepartment = manualMoveDepartments.find((department) => department.id === instructionGateDepartmentId) ?? null;
  const submitDestinationOptions = useMemo(
    () => manualMoveDepartments.filter((department) => department.id !== selectedPart?.currentDepartmentId),
    [manualMoveDepartments, selectedPart?.currentDepartmentId]
  );
  const selectedPartAcknowledgedReceipts = useMemo(() => {
    const receipts = Array.isArray(selectedPart?.instructionReceipts) ? selectedPart.instructionReceipts : [];
    if (!selectedPartCurrentDepartmentId) return [];
    return receipts.filter(
      (receipt: any) =>
        receipt?.departmentId === selectedPartCurrentDepartmentId &&
        Math.max(1, Number(receipt?.instructionsVersion ?? 1)) === selectedPartInstructionsVersion,
    );
  }, [selectedPart?.instructionReceipts, selectedPartCurrentDepartmentId, selectedPartInstructionsVersion]);
  const acknowledgedWorkerIds = useMemo(
    () => new Set(selectedPartAcknowledgedReceipts.map((receipt: any) => receipt.userId)),
    [selectedPartAcknowledgedReceipts],
  );
  const acknowledgedWorkers = useMemo(
    () => timerWorkerOptions.filter((user) => acknowledgedWorkerIds.has(user.id)),
    [acknowledgedWorkerIds, timerWorkerOptions],
  );
  const unacknowledgedWorkers = useMemo(
    () => timerWorkerOptions.filter((user) => !acknowledgedWorkerIds.has(user.id)),
    [acknowledgedWorkerIds, timerWorkerOptions],
  );

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

  const selectedPartLaborEntries = useMemo(
    () =>
      (Array.isArray(item?.timeEntries) ? item.timeEntries : []).filter(
        (entry: any) => entry.partId === selectedPartId,
      ),
    [item?.timeEntries, selectedPartId],
  );

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
  const selectedPartActiveTimerCount = selectedPartId
    ? Array.isArray(partActivity[selectedPartId]?.activeTimers)
      ? partActivity[selectedPartId].activeTimers.length
      : 0
    : 0;

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
    const interval = selectedPartActiveTimerCount ? window.setInterval(() => setNowMs(Date.now()), 1000) : null;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [selectedPartActiveTimerCount]);

  const load = React.useCallback(async () => {
    if (!id) return null;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { credentials: 'include' });
      if (!res.ok) throw res;
      const data = await res.json();
      setItem(data.item);
      setDepartments(
        Array.isArray(data?.departments)
          ? data.departments
              .map((department: any) => ({
                id: String(department?.id ?? ''),
                name: String(department?.name ?? '').trim(),
              }))
              .filter((department: SelectOption) => department.id.length > 0 && department.name.length > 0)
          : []
      );
      setCanEditParts(Boolean(data?.permissions?.canEditParts));
      setCanEditOrderStatus(Boolean(data?.permissions?.canEditOrderStatus));
      setCanUseTimerControls(Boolean(data?.permissions?.canUseTimerControls ?? true));
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
      setPartActivity(data.partActivity ?? {});
      setTimerError(null);
    } catch {
      setTimerError('Failed to load timer status.');
      setPartActivity({});
    } finally {
      setTimerLoading(false);
    }
  }, [id, partIdsParam]);

  const refreshKioskSession = React.useCallback(async () => {
    if (canUseTimerControls) {
      setKioskSession(null);
      return null;
    }

    setKioskSessionLoading(true);
    try {
      const res = await fetch('/api/kiosk/session', { credentials: 'include' });
      if (res.status === 401) {
        setKioskSession(null);
        return null;
      }
      if (!res.ok) throw res;
      const data = await res.json().catch(() => null);
      setKioskSession(data);
      return data;
    } catch {
      setKioskSession(null);
      return null;
    } finally {
      setKioskSessionLoading(false);
    }
  }, [canUseTimerControls]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (canUseTimerControls) {
      setKioskSession(null);
      return;
    }
    void refreshKioskSession();
  }, [canUseTimerControls, refreshKioskSession]);

  useEffect(() => {
    let active = true;
    const loadTeamUsers = async () => {
      try {
        const res = await fetch('/api/admin/users?take=200', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!active) return;
        setTeamUsers(
          raw
            .map((user: any) => ({
              id: String(user?.id ?? ''),
              name: String(user?.name ?? '').trim(),
              email: typeof user?.email === 'string' ? user.email : null,
              role: typeof user?.role === 'string' ? user.role : null,
              active: typeof user?.active === 'boolean' ? user.active : null,
              kioskEnabled: typeof user?.kioskEnabled === 'boolean' ? user.kioskEnabled : null,
              primaryDepartmentId: typeof user?.primaryDepartmentId === 'string' ? user.primaryDepartmentId : null,
              primaryDepartment:
                user?.primaryDepartment && typeof user.primaryDepartment === 'object'
                  ? {
                      id: String(user.primaryDepartment.id ?? ''),
                      name: String(user.primaryDepartment.name ?? '').trim(),
                    }
                  : null,
            }))
            .filter((user: TeamUserOption) => user.id.length > 0),
        );
      } catch {
        if (active) setTeamUsers([]);
      }
    };

    void loadTeamUsers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!parts.length) {
      setSelectedPartId(null);
      return;
    }
    const requestedPartId = searchParams.get('part');
    setSelectedPartId((previousPartId) => {
      if (requestedPartId && parts.some((part: any) => part.id === requestedPartId)) {
        return requestedPartId;
      }
      if (previousPartId && parts.some((part: any) => part.id === previousPartId)) {
        return previousPartId;
      }
      return parts[0].id;
    });
  }, [parts, searchParams]);

  const selectPart = (partId: string) => {
    setSelectedPartId(partId);
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('part', partId);
    router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!item) return;
    setOrderDraft({
      business: item.business ?? '',
      customerId: item.customerId ?? '',
      customerContactId: item.customerContactId ?? '',
      receivedDate: item.receivedDate ? String(item.receivedDate).slice(0, 10) : '',
      dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
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
      partName: selectedPart.partName ?? '',
      quantity: Number(selectedPart.quantity ?? 1),
      materialId: selectedPart.materialId ?? '',
      materialStatus: selectedPart.materialStatus ?? 'UNREVIEWED',
      procurementVendorId: selectedPart.procurementVendorId ?? '',
      inventoryLocation: selectedPart.inventoryLocation ?? '',
      materialNotes: selectedPart.materialNotes ?? '',
      stockSize: selectedPart.stockSize ?? '',
      cutLength: selectedPart.cutLength ?? '',
      finalPartLength: selectedPart.finalPartLength ?? '',
      partWidth: selectedPart.partWidth ?? '',
      partThickness: selectedPart.partThickness ?? '',
      notes: selectedPart.notes ?? '',
      workInstructions: selectedPart.workInstructions ?? '',
    });
  }, [selectedPart]);

  useEffect(() => {
    if (!repeatTemplateDialogOpen) return;
    setRepeatTemplateName(defaultRepeatTemplateName);
    setRepeatTemplateError(null);
  }, [defaultRepeatTemplateName, repeatTemplateDialogOpen]);

  useEffect(() => {
    if (!timerDepartments.length) {
      setSelectedTimerDepartmentId('');
      return;
    }

    if (selectedTimerDepartmentId && timerDepartments.some((department) => department.id === selectedTimerDepartmentId)) {
      return;
    }

    const selectedPartDepartmentId = selectedPart?.currentDepartmentId ?? '';
    const nextDepartmentId =
      selectedPartDepartmentId && timerDepartments.some((department) => department.id === selectedPartDepartmentId)
        ? selectedPartDepartmentId
        : timerDepartments[0]?.id ?? '';
    setSelectedTimerDepartmentId(nextDepartmentId);
  }, [selectedPart?.currentDepartmentId, selectedTimerDepartmentId, timerDepartments]);

  useEffect(() => {
    if (selectedTimerWorkerId && timerWorkerOptions.some((user) => user.id === selectedTimerWorkerId)) {
      return;
    }
    setSelectedTimerWorkerId(currentUserId || timerWorkerOptions[0]?.id || '');
  }, [currentUserId, selectedTimerWorkerId, timerWorkerOptions]);

  useEffect(() => {
    if (!canEditParts) return;

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

      const fetchCustomers = async (): Promise<CustomerOption[]> => {
        const res = await fetch('/api/admin/customers?take=200', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        return items.map((entry: any) => ({
          id: String(entry.id ?? ''),
          name: String(entry.name ?? 'Unnamed'),
          contacts: Array.isArray(entry.contacts)
            ? entry.contacts.map((contact: any) => ({
                id: String(contact.id ?? ''),
                name: String(contact.name ?? contact.email ?? 'Unnamed contact'),
                email: contact.email ?? null,
                phone: contact.phone ?? null,
              })).filter((contact: { id: string }) => contact.id.length > 0)
            : [],
        })).filter((entry: CustomerOption) => entry.id.length > 0);
      };

      const [loadedCustomers, loadedVendors, loadedMachinists, loadedMaterials] = await Promise.all([
        fetchCustomers(),
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

  const isInstructionAcknowledgedForDepartment = (departmentId?: string | null) => {
    return isInstructionAcknowledgedForUserDepartment(currentUserId, departmentId);
  };

  const isInstructionAcknowledgedForUserDepartment = (
    userId?: string | null,
    departmentId?: string | null,
  ) => {
    if (!selectedPartInstructions) return true;
    return Boolean(getInstructionReceiptForUserDepartment(userId, departmentId));
  };

  const buildInstructionGateAction = (pendingAction: InstructionGatePendingAction) => {
    setInstructionGateDialog({
      open: true,
      loading: false,
      error: null,
      pendingAction,
      workerId:
        pendingAction.kind === 'timer-start'
          ? selectedTimerWorkerId || currentUserId || timerWorkerOptions[0]?.id || ''
          : currentUserId || timerWorkerOptions[0]?.id || '',
    });
  };

  const continueTimerStartAfterInstructionGate = ({ workerId }: { workerId: string }) => {
    const departmentId = selectedTimerDepartmentId || selectedPartCurrentDepartmentId || '';
    if (!selectedPartId || !departmentId) return;
    openKioskTimerDialog('start', {
      workerId,
      departmentId,
      partId: selectedPartId,
      targetTimer: {
        userName: timerWorkerOptions.find((user) => user.id === workerId)?.name || 'Worker',
        departmentName:
          timerDepartments.find((department) => department.id === departmentId)?.name ??
          departmentId,
        partLabel: selectedPart?.partNumber || 'Selected part',
      },
    });
  };

  const handleInstructionGateConfirm = async (): Promise<void> => {
    const pendingAction = instructionGateDialog.pendingAction;
    if (!selectedPartId) {
      setInstructionGateDialog((prev) => ({ ...prev, error: 'Select a part and department first.' }));
      return;
    }

    const departmentId = !pendingAction
      ? selectedPartCurrentDepartmentId
      : pendingAction.kind === 'timer-start'
        ? selectedTimerDepartmentId || selectedPartCurrentDepartmentId
        : pendingAction.kind === 'checklist-toggle'
          ? pendingAction.entry?.departmentId ?? selectedPartCurrentDepartmentId
          : selectedPartCurrentDepartmentId;
    if (!departmentId) {
      setInstructionGateDialog((prev) => ({ ...prev, error: 'Select a department first.' }));
      return;
    }

    if (!selectedPartInstructions) {
      setInstructionGateDialog({
        open: false,
        loading: false,
        error: null,
        pendingAction: null,
        workerId: '',
      });
      if (pendingAction?.kind === 'timer-start') {
        continueTimerStartAfterInstructionGate({
          workerId: instructionGateDialog.workerId || selectedTimerWorkerId,
        });
      } else if (pendingAction?.kind === 'checklist-toggle') {
        setChecklistPerformerDialog({
          open: true,
          loading: false,
          error: null,
          entry: pendingAction.entry,
          checked: pendingAction.checked,
          performerId: currentUserId || performerUsers[0]?.id || '',
        });
      } else if (pendingAction?.kind === 'submit-department') {
        setSubmitConfirmDialog({
          open: true,
          destinationDepartmentId: pendingAction.destinationDepartmentId,
          note: pendingAction.note,
          error: null,
        });
      }
      return;
    }

    const timerStartWorkerId =
      pendingAction?.kind === 'timer-start'
        ? instructionGateDialog.workerId.trim() || selectedTimerWorkerId
        : '';
    const acknowledgementWorkerId = timerStartWorkerId || currentUserId;
    if (pendingAction?.kind === 'timer-start' && !timerStartWorkerId) {
      setInstructionGateDialog((prev) => ({ ...prev, error: 'Choose the worker who read these instructions.' }));
      return;
    }
    if (!acknowledgementWorkerId) {
      setInstructionGateDialog((prev) => ({ ...prev, error: 'Choose the employee acknowledging these instructions.' }));
      return;
    }

    setInstructionGateDialog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/acknowledge-instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          departmentId,
          workerId: acknowledgementWorkerId || undefined,
          trustedConsole: pendingAction?.kind === 'timer-start',
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to acknowledge instructions.');
      }

      setInstructionGateDialog({
        open: false,
        loading: false,
        error: null,
        pendingAction: null,
        workerId: '',
      });
      toast.push('Instructions acknowledged.', 'success');
      await load();
      await loadPartEvents();

      if (pendingAction?.kind === 'timer-start') {
        await continueTimerStartAfterInstructionGate({
          workerId: timerStartWorkerId,
        });
      } else if (pendingAction?.kind === 'checklist-toggle') {
        setChecklistPerformerDialog({
          open: true,
          loading: false,
          error: null,
          entry: pendingAction.entry,
          checked: pendingAction.checked,
          performerId: currentUserId || performerUsers[0]?.id || '',
        });
      } else if (pendingAction?.kind === 'submit-department') {
        setSubmitConfirmDialog({
          open: true,
          destinationDepartmentId: pendingAction.destinationDepartmentId,
          note: pendingAction.note,
          error: null,
        });
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to acknowledge instructions.';
      setInstructionGateDialog((prev) => ({ ...prev, loading: false, error: message }));
      toast.push(message, 'error');
      return;
    }
  };

  const handleStart = async ({ skipInstructionGate = false }: { skipInstructionGate?: boolean } = {}): Promise<boolean> => {
    if (!id || !selectedPartId) return false;
    if (!selectedTimerDepartmentId) {
      setTimerError('Please choose a department before starting a timer.');
      return false;
    }
    if (!skipInstructionGate && !isInstructionAcknowledgedForDepartment(selectedTimerDepartmentId)) {
      buildInstructionGateAction({ kind: 'timer-start' });
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

  const closeKioskTimerDialog = () => {
    setKioskTimerDialog({
      open: false,
      mode: 'start',
      workerId: '',
      departmentId: '',
      pin: '',
      partId: '',
      loading: false,
      error: null,
      targetTimer: null,
      conflict: null,
    });
  };

  const openKioskTimerDialog = (
    mode: KioskTimerDialogMode,
    options?: {
      workerId?: string;
      departmentId?: string;
      partId?: string;
      targetTimer?: {
        userName: string;
        departmentName: string | null;
        partLabel: string | null;
      } | null;
    },
  ) => {
    const defaultWorkerId = options?.workerId ?? kioskSession?.worker?.id ?? currentUserId ?? kioskWorkers[0]?.id ?? '';
    const defaultWorker =
      kioskWorkers.find((user) => user.id === defaultWorkerId) ??
      kioskWorkers[0] ??
      null;
    const defaultDepartmentId =
      options?.departmentId ??
      defaultWorker?.primaryDepartmentId ??
      selectedTimerDepartmentId ??
      timerDepartments[0]?.id ??
      '';
    setKioskTimerDialog({
      open: true,
      mode,
      workerId: defaultWorkerId,
      departmentId: defaultDepartmentId,
      pin: '',
      partId: options?.partId ?? selectedPartId ?? parts[0]?.id ?? '',
      loading: false,
      error: null,
      targetTimer: options?.targetTimer ?? null,
      conflict: null,
    });
  };

  const unlockKioskSession = async ({ workerId, pin }: { workerId: string; pin: string }) => {
    const res = await fetch('/api/kiosk/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: workerId, pin }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to unlock kiosk.');
    }
    setKioskSession(data);
    return data;
  };

  const ensureKioskSession = async ({ workerId, pin }: { workerId: string; pin: string }) => {
    if (!workerId) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Choose a worker first.',
      }));
      return null;
    }
    if (!pin.trim()) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Enter your PIN to continue.',
      }));
      return null;
    }

    try {
      return await unlockKioskSession({ workerId, pin: pin.trim() });
    } catch (error: any) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to unlock kiosk.',
      }));
      return null;
    }
  };

  const runKioskTimerAction = async (action: 'pause' | 'finish'): Promise<boolean> => {
    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch(`/api/kiosk/timer/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          setKioskSession(null);
          openKioskTimerDialog(action);
          setKioskTimerDialog((prev) => ({
            ...prev,
            error: 'Enter your PIN to continue.',
          }));
          return false;
        }
        setTimerError(typeof data?.error === 'string' ? data.error : `Failed to ${action} timer.`);
        return false;
      }
      if (action === 'finish') {
        await load();
      }
      await refreshTimerSummary();
      await loadPartEvents();
      await refreshKioskSession();
      return true;
    } catch {
      setTimerError(`Failed to ${action} timer.`);
      return false;
    } finally {
      setTimerSaving(false);
    }
  };

  const handleKioskDialogConfirm = async (
    modeOverride?: KioskTimerDialogMode,
  ): Promise<boolean> => {
    if (!id) return false;
    const actionMode = modeOverride ?? kioskTimerDialog.mode;
    setKioskTimerDialog((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    const workerUserId = kioskTimerDialog.workerId.trim();
    const partId = kioskTimerDialog.partId.trim();
    if (!workerUserId) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Choose an employee first.',
      }));
      return false;
    }
    if (kioskTimerDialog.mode === 'start' && !partId) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Choose a part on this order.',
      }));
      return false;
    }
    try {
      const endpoint =
        actionMode === 'start'
          ? '/api/dispatch/timer/start'
          : `/api/dispatch/timer/${actionMode}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workerUserId,
          entryId: selectedPartActiveTimers.find((entry: any) => entry.userId === workerUserId)?.id,
          ...(actionMode === 'start'
            ? {
                orderId: id,
                partId,
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409 && data?.error?.requiredAction === 'instruction_confirmation') {
          closeKioskTimerDialog();
          setInstructionGateDialog({
            open: true,
            loading: false,
            error: null,
            pendingAction: { kind: 'timer-start' },
            workerId: workerUserId,
          });
          return false;
        }
        if (res.status === 409 && data?.error?.requiredAction === 'switch_confirmation') {
          setKioskTimerDialog((prev) => ({
            ...prev,
            loading: false,
            error: null,
            conflict: {
              activeEntry: data.error.activeEntry ?? null,
              activeOrder: data.error.activeOrder ?? null,
              activePart: data.error.activePart ?? null,
              elapsedSeconds: Number(data.error.elapsedSeconds ?? 0),
            },
          }));
          return false;
        }
        setKioskTimerDialog((prev) => ({
          ...prev,
          loading: false,
          error:
            typeof data?.error === 'string'
              ? data.error
              : typeof data?.error?.message === 'string'
                ? data.error.message
                : `Failed to ${actionMode} timer.`,
        }));
        return false;
      }

      if (partId) setSelectedPartId(partId);
      closeKioskTimerDialog();
      await refreshTimerSummary();
      await load();
      await loadPartEvents();
      return true;
    } catch {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: `Failed to ${actionMode} timer.`,
      }));
      return false;
    }
  };

  const handleKioskSwitch = async (): Promise<boolean> => {
    if (!id) return false;

    setKioskTimerDialog((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    const partId = kioskTimerDialog.partId.trim();
    const workerUserId = kioskTimerDialog.workerId.trim();
    if (!partId || !workerUserId) {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Choose a part and employee.',
      }));
      return false;
    }

    try {
      const res = await fetch('/api/dispatch/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workerUserId,
          orderId: id,
          partId,
          confirmSwitch: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setKioskTimerDialog((prev) => ({
          ...prev,
          loading: false,
          error:
            typeof data?.error === 'string'
              ? data.error
              : typeof data?.error?.message === 'string'
                ? data.error.message
                : 'Failed to switch timer.',
        }));
        return false;
      }

      setSelectedPartId(partId);
      closeKioskTimerDialog();
      await refreshTimerSummary();
      await load();
      await loadPartEvents();
      return true;
    } catch {
      setKioskTimerDialog((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to switch timer.',
      }));
      return false;
    }
  };

  const handleKioskAction = async (action: 'pause' | 'finish'): Promise<boolean> => {
    if (!kioskSession) {
      openKioskTimerDialog(action);
      return false;
    }
    return runKioskTimerAction(action);
  };

  const handleOpenActiveTimerChip = (entry: any) => {
    const workerName =
      entry?.user?.name?.trim() ||
      entry?.user?.email?.trim() ||
      entry?.userId ||
      'Worker';
    const departmentName =
      typeof entry?.departmentName === 'string' && entry.departmentName.trim().length
        ? entry.departmentName.trim()
        : typeof entry?.departmentId === 'string' && entry.departmentId.trim().length
          ? entry.departmentId.trim()
          : null;
    const partLabel = selectedPart?.partNumber || (selectedPartId ? 'Selected part' : null);

    openKioskTimerDialog('finish', {
      workerId: entry?.userId ?? '',
      departmentId: entry?.departmentId ?? '',
      partId: entry?.partId ?? selectedPartId ?? '',
      targetTimer: {
        userName: workerName,
        departmentName,
        partLabel,
      },
    });
  };

  const handleOpenTimerStartDialog = () => {
    if (!selectedPartId) {
      setTimerError('Choose a part first.');
      return;
    }
    if (!selectedTimerWorkerId) {
      setTimerError('Choose an employee first.');
      return;
    }
    setTimerError(null);
    const departmentId = selectedPartCurrentDepartmentId || selectedTimerDepartmentId;
    if (
      selectedPartInstructions &&
      !getInstructionReceiptForUserDepartment(selectedTimerWorkerId, departmentId)
    ) {
      buildInstructionGateAction({ kind: 'timer-start' });
      return;
    }
    openKioskTimerDialog('start', {
      workerId: selectedTimerWorkerId,
      departmentId: departmentId ?? '',
      partId: selectedPartId,
      targetTimer: {
        userName: selectedTimerWorker?.name || 'Worker',
        departmentName:
          timerDepartments.find((department) => department.id === selectedTimerDepartmentId)?.name ??
          selectedTimerDepartmentId,
        partLabel: selectedPart?.partNumber || 'Selected part',
      },
    });
  };

  const openMoveDepartmentDialog = () => {
    if (!selectedPartId) return;
    const defaultDepartmentId =
      nextDepartmentOption?.id ||
      submitDestinationOptions[0]?.id ||
      '';
    setMoveDepartmentDialog({
      open: true,
      destinationDepartmentId: defaultDepartmentId,
      note: '',
      error: null,
    });
  };

  const handleMoveDepartment = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;
    const destinationDepartmentId = moveDepartmentDialog.destinationDepartmentId;
    const note = moveDepartmentDialog.note.trim();
    if (!destinationDepartmentId) {
      setMoveDepartmentDialog((prev) => ({ ...prev, error: 'Choose a destination department.' }));
      return false;
    }
    if (!note) {
      setMoveDepartmentDialog((prev) => ({ ...prev, error: 'A note is required so this move is recorded clearly.' }));
      return false;
    }
    if (activeOnSelected) {
      setMoveDepartmentDialog((prev) => ({
        ...prev,
        error: 'Pause or finish every active employee timer before moving this part.',
      }));
      return false;
    }

    setTimerSaving(true);
    setMoveDepartmentDialog((prev) => ({ ...prev, error: null }));
    try {
      const res = await fetch(`/api/orders/${id}/parts/assign-department`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          partId: selectedPartId,
          departmentId: destinationDepartmentId,
          reasonCode: 'MANUAL_MOVE',
          reasonText: note,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldMessage = payload?.error?.fieldErrors?.reasonText?.[0];
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : typeof fieldMessage === 'string'
              ? fieldMessage
              : 'Failed to move department.',
        );
      }

      const destination = manualMoveDepartments.find((department) => department.id === destinationDepartmentId);
      await load();
      await refreshTimerSummary();
      await loadPartEvents();
      setMoveDepartmentDialog({
        open: false,
        destinationDepartmentId: '',
        note: '',
        error: null,
      });
      toast.push(
        selectedPartCurrentDepartmentId
          ? `Part moved to ${destination?.name ?? 'the selected department'}.`
          : `Part assigned to ${destination?.name ?? 'the selected department'}.`,
        'success',
      );
      return true;
    } catch (err: any) {
      setMoveDepartmentDialog((prev) => ({
        ...prev,
        error: err?.message || 'Failed to move department.',
      }));
      return false;
    } finally {
      setTimerSaving(false);
    }
  };

  const handleBeginSubmitDepartmentComplete = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;

    if (departmentSubmitBlocker) {
      setTimerError(departmentSubmitBlocker);
      return false;
    }

    const currentDepartmentId = selectedPart?.currentDepartmentId ?? '';
    const destinationDepartmentId = nextDepartmentOption?.id ?? currentDepartmentId;
    const moveNote = `Submitted ${selectedCurrentDepartment?.name ?? 'department'} complete.`;

    if (!isInstructionAcknowledgedForDepartment(currentDepartmentId)) {
      buildInstructionGateAction({
        kind: 'submit-department',
        destinationDepartmentId,
        note: moveNote,
      });
      return false;
    }

    setSubmitConfirmDialog({
      open: true,
      destinationDepartmentId,
      note: moveNote,
      error: null,
    });
    return true;
  };

  const handleSubmitDepartmentComplete = async (): Promise<boolean> => {
    if (!id || !selectedPartId) return false;

    setTimerSaving(true);
    setTimerError(null);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/submit-department-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to submit department complete.');
      }

      await load();
      await refreshTimerSummary();
      await loadPartEvents();
      setSubmitConfirmDialog({
        open: false,
        destinationDepartmentId: '',
        note: '',
        error: null,
      });
      setMoveDepartmentDialog({
        open: false,
        destinationDepartmentId: '',
        note: '',
        error: null,
      });
      const nextDepartment = manualMoveDepartments.find(
        (department) => department.id === payload?.part?.currentDepartmentId,
      );
      toast.push(
        payload?.part?.status === 'COMPLETE'
          ? 'All department work is complete.'
          : `Department complete. Part moved to ${nextDepartment?.name ?? 'the next department'}.`,
        'success',
      );
      return true;
    } catch (err: any) {
      const message = err?.message || 'Failed to submit department complete.';
      setSubmitConfirmDialog((prev) => ({ ...prev, error: message }));
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


  const handleSaveRepeatTemplate = async ({ launch = false }: { launch?: boolean } = {}) => {
    if (!id || !selectedPartId || !canEditParts) return;
    setRepeatTemplateSaving(true);
    setRepeatTemplateError(null);
    try {
      const res = await fetch(`/api/repeat-order-templates/from-order/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: repeatTemplateName.trim() || undefined,
          partId: selectedPartId,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : typeof payload?.error?.message === 'string'
              ? payload.error.message
              : 'Failed to save repeat-order template.';
        throw new Error(message);
      }
      const data = await res.json().catch(() => null);
      const template = data?.template;
      const savedTemplate =
        template && typeof template.id === 'string' && typeof template.name === 'string'
          ? { id: template.id, name: template.name }
          : null;
      setSavedRepeatTemplate(savedTemplate);
      setRepeatTemplateDialogOpen(false);
      if (launch && savedTemplate) {
        router.push(`/orders/new?templateId=${savedTemplate.id}`);
        return;
      }
      toast.push('Customer-part repeat template saved.', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to save repeat-order template.';
      setRepeatTemplateError(message);
      toast.push(message, 'error');
    } finally {
      setRepeatTemplateSaving(false);
    }
  };

  const handleSaveOrderDetails = async () => {
    if (!id || !canEditParts) return;
    setSavingOrderDetails(true);
    try {
      const payload: Record<string, unknown> = {
        business: orderDraft.business || undefined,
        customerId: orderDraft.customerId || undefined,
        customerContactId: orderDraft.customerContactId || null,
        receivedDate: orderDraft.receivedDate || undefined,
        dueDate: orderDraft.dueDate || undefined,
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

  const handlePriorityChange = async (priority: string) => {
    if (!id || !canEditOrderStatus || prioritySaving || priority === item?.priority) return;
    setPrioritySaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to update priority.');
      }
      setItem((current: any) => current ? { ...current, priority } : current);
      toast.push(`Priority changed to ${priority}.`, 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to update priority.', 'error');
    } finally {
      setPrioritySaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!id || !canEditOrderStatus || statusChangeDialog.saving || !statusChangeDialog.reason.trim()) return;
    setStatusChangeDialog((current) => ({ ...current, saving: true, error: null }));
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: statusChangeDialog.status,
          reason: statusChangeDialog.reason.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to update order status.');
      }
      await load();
      setStatusChangeDialog({ open: false, status: 'RECEIVED', reason: '', saving: false, error: null });
      toast.push('Order status updated and recorded in history.', 'success');
    } catch (err: any) {
      setStatusChangeDialog((current) => ({
        ...current,
        saving: false,
        error: err?.message || 'Failed to update order status.',
      }));
    }
  };

  const handleSavePartDetails = async () => {
    if (!id || !selectedPartId || !canEditParts) return;
    setSavingPartDetails(true);
    try {
      const payload = {
        partNumber: partDraft.partNumber,
        partName: partDraft.partName || null,
        quantity: Number(partDraft.quantity),
        materialId: partDraft.materialId || null,
        materialStatus: partDraft.materialStatus,
        procurementVendorId: partDraft.procurementVendorId || null,
        inventoryLocation: partDraft.inventoryLocation || null,
        materialNotes: partDraft.materialNotes || null,
        stockSize: partDraft.stockSize || null,
        cutLength: partDraft.cutLength || null,
        finalPartLength: partDraft.finalPartLength || null,
        partWidth: partDraft.partWidth || null,
        partThickness: partDraft.partThickness || null,
        notes: partDraft.notes || null,
        workInstructions: partDraft.workInstructions || null,
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

  const handleQuickMaterialStatusChange = async (materialStatus: string) => {
    if (!id || !selectedPartId || !canEditParts || materialStatusSaving) return;
    setMaterialStatusSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ materialStatus }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to update material status.');
      }
      setItem((current: any) => current ? {
        ...current,
        parts: (current.parts ?? []).map((part: any) => (
          part.id === selectedPartId ? { ...part, ...(body?.part ?? {}), materialStatus } : part
        )),
      } : current);
      setPartDraft((current) => ({ ...current, materialStatus }));
      toast.push(`Material status changed to ${formatPartMaterialStatus(materialStatus)}.`, 'success');
    } catch (err: any) {
      toast.push(err?.message || 'Failed to update material status.', 'error');
    } finally {
      setMaterialStatusSaving(false);
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
    performedById: string,
    extra: { reasonCode?: string; reasonText?: string } = {},
  ) => {
    const res = await fetch(`/api/orders/${id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklistId: entry.id,
        checked,
        partId: selectedPartId,
        performedById,
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

    const checklistDepartmentId = entry?.departmentId ?? selectedPartCurrentDepartmentId ?? null;
    if (checked && checklistDepartmentId && !isInstructionAcknowledgedForDepartment(checklistDepartmentId)) {
      buildInstructionGateAction({ kind: 'checklist-toggle', entry, checked });
      return;
    }

    setChecklistPerformerDialog({
      open: true,
      loading: false,
      error: null,
      entry,
      checked,
      performerId: currentUserId || performerUsers[0]?.id || '',
    });
  };

  const handleChecklistPerformerConfirm = async (): Promise<boolean> => {
    const entry = checklistPerformerDialog.entry;
    if (!entry || !selectedPartId) return false;
    const performerId = checklistPerformerDialog.performerId || currentUserId || '';
    const performer = performerUsers.find((user) => user.id === performerId) ?? null;
    if (!performerId) {
      setChecklistPerformerDialog((prev) => ({ ...prev, error: 'Select who performed the work.' }));
      return false;
    }

    setChecklistPerformerDialog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await postChecklistToggle(entry, checklistPerformerDialog.checked, performerId);
      setChecklistPerformerDialog({
        open: false,
        loading: false,
        error: null,
        entry: null,
        checked: false,
        performerId: currentUserId || performerUsers[0]?.id || '',
      });
      await load();
      await loadPartEvents();
      toast.push(
        performer && performer.id !== currentUserId
          ? `Checklist saved for ${performer.name}.`
          : 'Checklist saved.',
        'success',
      );
      return true;
    } catch (err: any) {
      const message = err?.message || 'Failed to toggle checklist item.';
      setChecklistPerformerDialog((prev) => ({ ...prev, loading: false, error: message }));
      setChecklistError(message);
      toast.push(message, 'error');
      return false;
    }
  };

  useEffect(() => {
    if (!selectedPartId) return;
    setAssignmentUserId((prev) => {
      if (prev && performerUsers.some((user) => user.id === prev)) return prev;
      return currentUserId || performerUsers[0]?.id || '';
    });
  }, [currentUserId, performerUsers, selectedPartId]);

  const handleAssignWorkerToSelectedPart = async () => {
    if (!id || !selectedPartId || !canEditParts) return;
    if (!assignmentUserId) {
      setAssignmentError('Choose a worker to assign.');
      return;
    }

    setAssignmentSaving(true);
    setAssignmentError(null);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: assignmentUserId, assignmentType: 'WORKER' }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to assign worker.');
      }
      setAssignmentUserId('');
      await load();
      await loadPartEvents();
      toast.push('Worker assigned to part.', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to assign worker.';
      setAssignmentError(message);
      toast.push(message, 'error');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleRemoveWorkerAssignment = async (assignmentId: string) => {
    if (!id || !selectedPartId || !canEditParts) return;
    const confirmed = window.confirm('Remove this worker from the part?');
    if (!confirmed) return;

    setAssignmentSaving(true);
    setAssignmentError(null);
    try {
      const res = await fetch(`/api/orders/${id}/parts/${selectedPartId}/assignments/${assignmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to remove worker assignment.');
      }
      await load();
      await loadPartEvents();
      toast.push('Worker removed from part.', 'success');
    } catch (err: any) {
      const message = err?.message || 'Failed to remove worker assignment.';
      setAssignmentError(message);
      toast.push(message, 'error');
    } finally {
      setAssignmentSaving(false);
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
  const dueDateLabel = item.dueDate
    ? new Date(item.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' })
    : 'TBD';
  const statusLabel = item.status
    ? String(item.status)
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
    : 'Unknown';
  const selectedPartActivity = selectedPartId ? partActivity[selectedPartId] ?? null : null;
  const selectedPartActiveTimers = Array.isArray(selectedPartActivity?.activeTimers)
    ? selectedPartActivity.activeTimers
    : [];
  const activeOnSelected = selectedPartActiveTimers.length > 0;
  const selectedPartTimerSeconds = selectedPartId ? partTotals[selectedPartId] ?? 0 : 0;
  const selectedPartManualSeconds = selectedPartId ? manualPartTotals[selectedPartId] ?? 0 : 0;
  const selectedPartStoredSeconds = selectedPartTimerSeconds;
  const selectedPartLiveSeconds = selectedPartActiveTimers.reduce((sum: number, entry: any) => {
    const startedAtMs = entry?.startedAt ? new Date(entry.startedAt).getTime() : Number.NaN;
    if (!Number.isFinite(startedAtMs)) return sum;
    return sum + Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  }, 0);
  const selectedPartElapsedSeconds = selectedPartStoredSeconds + selectedPartLiveSeconds;
  const hasActiveEntry = activeEntries.length > 0;
  const activeElsewhereEntries = activeEntries.filter((entry: any) => {
    const samePart = entry?.partId === selectedPartId;
    const sameDepartment = !selectedTimerDepartmentId || entry?.departmentId === selectedTimerDepartmentId;
    return !(samePart && sameDepartment);
  });
  const activeElsewhereEntry = activeElsewhereEntries[0] ?? null;
  const otherActiveEntryCount = activeElsewhereEntries.length;
  const otherTimerBadgeLabel =
    otherActiveEntryCount > 1 ? `${otherActiveEntryCount} other timers live` : 'Other timer live';
  const startHelperLabel = 'Starts a timer on the selected part for the selected department. Department moves are manual only.';
  const kioskDefaultDepartmentName = selectedKioskWorker?.primaryDepartment?.name ?? kioskSession?.worker?.primaryDepartment?.name ?? null;
  const kioskHelperLabel = kioskDefaultDepartmentName
    ? `Choose a worker, choose a department, and enter that worker's PIN to time this order. ${kioskDefaultDepartmentName} is the current default department for the selected worker.`
    : 'Choose a worker, choose a department, and enter that worker\'s PIN to time this order.';
  const currentDepartmentChecklistItems = selectedChecklist.filter(
    (entry: any) =>
      entry.isActive !== false && entry.departmentId === selectedPartCurrentDepartmentId,
  );
  const currentDepartmentOpenItemCount = currentDepartmentChecklistItems.filter(
    (entry: any) => entry.completed === false,
  ).length;
  const nextDepartmentId = findNextDepartmentWithOpenChecklist(selectedChecklist, manualMoveDepartments);
  const nextDepartmentOption =
    currentDepartmentChecklistItems.length > 0 && currentDepartmentOpenItemCount === 0
      ? manualMoveDepartments.find((department) => department.id === nextDepartmentId) ?? null
      : null;
  const departmentCompletionPreview = !currentDepartmentChecklistItems.length
    ? 'Cannot submit: this department has no checklist items.'
    : currentDepartmentOpenItemCount > 0
      ? `Finish ${currentDepartmentOpenItemCount} open checklist item${currentDepartmentOpenItemCount === 1 ? '' : 's'} first.`
      : nextDepartmentOption
        ? `Move to ${nextDepartmentOption.name}`
        : 'Mark the part complete';
  const departmentSubmitBlocker = activeOnSelected
    ? 'Pause or finish every active employee timer before submitting this department complete.'
    : !currentDepartmentChecklistItems.length
      ? 'This department cannot be submitted because it has no checklist items. Use Move department if the part needs to go elsewhere.'
      : currentDepartmentOpenItemCount > 0
        ? `Complete ${currentDepartmentOpenItemCount} remaining checklist item${currentDepartmentOpenItemCount === 1 ? '' : 's'} before submitting this department.`
        : null;
  const canSubmitCurrentDepartment = Boolean(selectedPartCurrentDepartmentId) && !departmentSubmitBlocker;
  const canMarkPartComplete = (selectedCurrentDepartment?.name ?? '').trim().toLowerCase() === 'shipping';
  const canStartSelectedPartTimer =
    selectedPart?.status !== 'COMPLETE' &&
    (selectedCurrentDepartment?.name ?? '').trim().toLowerCase() !== 'shipping';
  const timerReadOnlyMessage = canStartSelectedPartTimer
    ? 'Choose an employee. This trusted console records the employee and the signed-in operator separately.'
    : 'New timers are unavailable after a part reaches Shipping or is complete. Existing timers can still be paused or finished above.';

  return (
    <div className="order-detail-page -mt-4 space-y-4 sm:mt-0 sm:space-y-6">
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
      <Dialog
        open={kioskTimerDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeKioskTimerDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {kioskTimerDialog.mode === 'start'
                ? 'Start timer'
                : kioskTimerDialog.mode === 'pause'
                  ? 'Pause timer'
                  : 'Stop timer'}
            </DialogTitle>
            <DialogDescription>
              {kioskTimerDialog.mode === 'start'
                ? 'The signed-in shop console will record time for the selected employee.'
                : 'The signed-in shop console will record who performed this timer action.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-3 text-sm text-foreground">
              <div><span className="font-medium text-muted-foreground">Worker:</span> {selectedKioskWorker?.name || kioskTimerDialog.targetTimer?.userName || 'Unassigned'}</div>
              <div><span className="font-medium text-muted-foreground">Department:</span> {timerDepartments.find((department) => department.id === kioskTimerDialog.departmentId)?.name || kioskTimerDialog.targetTimer?.departmentName || 'Unassigned'}</div>
              <div><span className="font-medium text-muted-foreground">Part:</span> {selectedPart?.partNumber || kioskTimerDialog.targetTimer?.partLabel || 'Unassigned'}</div>
            </div>

            {false ? (
              <div className="grid gap-2">
                <Label htmlFor="kiosk-order-part">Part on this order</Label>
                <Select
                  value={kioskTimerDialog.partId || '__none__'}
                  onValueChange={(value) =>
                    setKioskTimerDialog((prev) => ({
                      ...prev,
                      partId: value === '__none__' ? '' : value,
                      error: null,
                    }))
                  }
                >
                  <SelectTrigger id="kiosk-order-part">
                    <SelectValue placeholder="Choose part to start" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choose part</SelectItem>
                    {parts.map((part: any, index: number) => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.partNumber || `Part ${index + 1}`}{part.partName ? ` — ${part.partName}` : ''} · Qty {part.quantity ?? 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {kioskTimerDialog.conflict ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-foreground">
                <div className="font-medium">
                  Timer already running on{' '}
                  {kioskTimerDialog.conflict.activeOrder?.orderNumber || 'another order'}
                  {kioskTimerDialog.conflict.activePart?.partNumber
                    ? ` · ${kioskTimerDialog.conflict.activePart.partNumber}`
                    : ''}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Elapsed {formatDuration(kioskTimerDialog.conflict.elapsedSeconds ?? 0)}.
                </div>
                <div className="mt-1 text-muted-foreground">
                  Pause that timer and start this part without losing the original assignment.
                </div>
              </div>
            ) : null}

            {kioskTimerDialog.mode !== 'start' && kioskTimerDialog.targetTimer ? (
              <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-3 text-sm text-foreground">
                {kioskTimerDialog.mode === 'pause' ? 'Pause' : 'Finish'} timer for {kioskTimerDialog.targetTimer.userName}
                {kioskTimerDialog.targetTimer.departmentName ? ` in ${kioskTimerDialog.targetTimer.departmentName}` : ''}
                {kioskTimerDialog.targetTimer.partLabel ? ` on ${kioskTimerDialog.targetTimer.partLabel}` : ''}.
              </div>
            ) : null}

            {kioskTimerDialog.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {kioskTimerDialog.error}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeKioskTimerDialog} disabled={kioskTimerDialog.loading}>
              Cancel
            </Button>
            {kioskTimerDialog.conflict ? (
              <Button type="button" onClick={() => void handleKioskSwitch()} disabled={kioskTimerDialog.loading}>
                {kioskTimerDialog.loading ? 'Switching…' : 'Pause & switch'}
              </Button>
            ) : (
              <>
              {kioskTimerDialog.mode === 'finish' ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleKioskDialogConfirm('pause')}
                  disabled={kioskTimerDialog.loading}
                >
                  Pause timer
                </Button>
              ) : null}
              <Button type="button" onClick={() => void handleKioskDialogConfirm()} disabled={kioskTimerDialog.loading}>
                {kioskTimerDialog.loading
                  ? kioskTimerDialog.mode === 'start'
                    ? 'Starting…'
                    : kioskTimerDialog.mode === 'pause'
                      ? 'Pausing…'
                      : 'Stopping…'
                  : kioskTimerDialog.mode === 'start'
                    ? 'Start timer'
                    : kioskTimerDialog.mode === 'pause'
                      ? 'Pause timer'
                      : 'Finish timer'}
              </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OrderStatusChangeDialog
        state={statusChangeDialog}
        currentStatus={item?.status ?? 'RECEIVED'}
        onChange={setStatusChangeDialog}
        onSave={() => void handleStatusChange()}
      />

      <Dialog
        open={repeatTemplateDialogOpen}
        onOpenChange={(open) => {
          setRepeatTemplateDialogOpen(open);
          if (!open) setRepeatTemplateError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save customer-part repeat template</DialogTitle>
            <DialogDescription>
              Save the selected part&apos;s manufacturing definition for this customer. This is not a document layout or a generic order format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="repeat-template-name">Template name</Label>
              <Input
                id="repeat-template-name"
                value={repeatTemplateName}
                onChange={(event) => {
                  setRepeatTemplateName(event.target.value);
                  setRepeatTemplateError(null);
                }}
                placeholder={defaultRepeatTemplateName}
              />
            </div>
            <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedPart?.partNumber ?? 'Selected part'}</span> for{' '}
              <span className="font-medium text-foreground">{item.customer?.name ?? 'this customer'}</span>, sourced from order{' '}
              <span className="font-medium text-foreground">#{item.orderNumber}</span>.
            </div>
            {repeatTemplateError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {repeatTemplateError}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRepeatTemplateDialogOpen(false)}
              disabled={repeatTemplateSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveRepeatTemplate()} disabled={repeatTemplateSaving || !selectedPartId}>
              {repeatTemplateSaving ? 'Saving...' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={moveDepartmentDialog.open}
        onOpenChange={(open) =>
          setMoveDepartmentDialog((prev) => ({
            ...prev,
            open,
            error: open ? prev.error : null,
          }))
        }
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedPartCurrentDepartmentId ? 'Move department' : 'Assign department'}</DialogTitle>
            <DialogDescription>
              {selectedPartCurrentDepartmentId
                ? 'Move this part without marking the current department complete. The destination and note are recorded in the part log.'
                : 'Choose the starting department for this part. The assignment and note are recorded in the part log.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current department</div>
              <div className="mt-1 font-semibold text-foreground">
                {selectedCurrentDepartment?.name ?? selectedPart?.currentDepartmentId ?? 'Unassigned'}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="move-department-destination">Destination department</Label>
              <Select
                value={moveDepartmentDialog.destinationDepartmentId}
                onValueChange={(destinationDepartmentId) =>
                  setMoveDepartmentDialog((prev) => ({ ...prev, destinationDepartmentId, error: null }))
                }
              >
                <SelectTrigger id="move-department-destination">
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  {submitDestinationOptions.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="move-department-note">
                {selectedPartCurrentDepartmentId ? 'Reason for move' : 'Reason for assignment'}
              </Label>
              <Textarea
                id="move-department-note"
                value={moveDepartmentDialog.note}
                onChange={(event) =>
                  setMoveDepartmentDialog((prev) => ({ ...prev, note: event.target.value, error: null }))
                }
                placeholder={selectedPartCurrentDepartmentId ? 'Why is this part moving departments?' : 'Why is this the correct starting department?'}
                rows={3}
              />
              <div className="text-xs text-muted-foreground">
                Required for the audit log. Moving backward is automatically flagged as rework.
              </div>
            </div>
            {activeOnSelected ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Pause or finish every active employee timer before moving this part.
              </div>
            ) : null}
            {moveDepartmentDialog.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {moveDepartmentDialog.error}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setMoveDepartmentDialog({
                  open: false,
                  destinationDepartmentId: '',
                  note: '',
                  error: null,
                })
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleMoveDepartment()}
              disabled={
                timerSaving ||
                activeOnSelected ||
                !moveDepartmentDialog.destinationDepartmentId ||
                !moveDepartmentDialog.note.trim()
              }
            >
              {timerSaving
                ? (selectedPartCurrentDepartmentId ? 'Moving…' : 'Assigning…')
                : (selectedPartCurrentDepartmentId ? 'Move department' : 'Assign department')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={instructionGateDialog.open}
        onOpenChange={(open) => {
          setInstructionGateDialog((prev) =>
            open
              ? { ...prev, open }
              : {
                  open: false,
                  loading: false,
                  error: null,
                  pendingAction: null,
                  workerId: '',
                },
          );
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mission brief: read before work</DialogTitle>
            <div className="text-sm text-muted-foreground">
              {selectedPart?.partNumber ? `Part ${selectedPart.partNumber}` : 'Selected part'}{selectedCurrentDepartment?.name ? ` · ${selectedCurrentDepartment.name}` : ''}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              Read this before you start work, check a checklist item, or submit the part forward. Your acknowledgement is recorded for this part and department.
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border/60 bg-muted/10 p-3 text-sm text-foreground">
              {selectedPartInstructionSections.length ? (
                <div className="space-y-4">
                  {selectedPartInstructionSections.map((section, index) => (
                    <div key={`${section.heading ?? 'notes'}-${index}`} className="space-y-2">
                      {section.heading ? (
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {section.heading}
                        </div>
                      ) : null}
                      <ul className="list-disc space-y-1 pl-5">
                        {section.items.map((item, itemIndex) => (
                          <li key={`${index}-${itemIndex}`} className="leading-6 text-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                'No part-specific instructions were found for this part.'
              )}
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
              <div className="font-semibold text-foreground">
                Acknowledging for{' '}
                {instructionGateDialog.pendingAction?.kind === 'timer-start'
                  ? selectedInstructionGateWorker?.name || 'Selected employee'
                  : currentUserName}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {instructionGateDialog.pendingAction?.kind === 'timer-start'
                  ? `No employee PIN is needed on this trusted console. ${currentUserName} will be recorded as the console operator.`
                  : 'Your acknowledgement is recorded under your signed-in account.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">
                Part: {selectedPart?.partNumber || 'Selected part'}
              </span>
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">
                Department: {instructionGateDepartment?.name ?? 'Current department'}
              </span>
              <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-foreground">
                Instruction version: {selectedPartInstructionsVersion}
              </span>
            </div>
            {instructionGateDialog.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {instructionGateDialog.error}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInstructionGateDialog({
                  open: false,
                  loading: false,
                  error: null,
                  pendingAction: null,
                  workerId: '',
                });
              }}
            >
              Not now
            </Button>
            <Button type="button" onClick={() => void handleInstructionGateConfirm()} disabled={instructionGateDialog.loading}>
              {!selectedPartInstructions
                ? 'Continue'
                : instructionGateDialog.loading
                  ? 'Recording…'
                  : instructionGateDialog.pendingAction?.kind === 'timer-start'
                    ? 'Acknowledge & continue to timer'
                    : 'I have read this'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={checklistPerformerDialog.open}
        onOpenChange={(open) =>
          setChecklistPerformerDialog((prev) => ({
            ...prev,
            open,
            error: open ? prev.error : null,
            loading: open ? prev.loading : false,
          }))
        }
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Who actually did it?</DialogTitle>
            <div className="text-sm text-muted-foreground">
              {checklistPerformerDialog.entry?.charge?.name ?? checklistPerformerDialog.entry?.addon?.name ?? 'Checklist item'}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="performer-select">Performed by</Label>
              <Select
                value={checklistPerformerDialog.performerId}
                onValueChange={(value) =>
                  setChecklistPerformerDialog((prev) => ({
                    ...prev,
                    performerId: value,
                    error: null,
                  }))
                }
              >
                <SelectTrigger id="performer-select">
                  <SelectValue placeholder="Choose who performed the work" />
                </SelectTrigger>
                <SelectContent>
                  {performerUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              Current user defaults to <span className="font-medium text-foreground">{currentUserName}</span>.
            </div>
            {checklistPerformerDialog.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {checklistPerformerDialog.error}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setChecklistPerformerDialog({
                  open: false,
                  loading: false,
                  error: null,
                  entry: null,
                  checked: false,
                  performerId: currentUserId || performerUsers[0]?.id || '',
                })
              }
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleChecklistPerformerConfirm()} disabled={checklistPerformerDialog.loading}>
              {checklistPerformerDialog.loading ? 'Saving…' : 'Save checklist action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={submitConfirmDialog.open}
        onOpenChange={(open) =>
          setSubmitConfirmDialog((prev) => ({
            ...prev,
            open,
            error: open ? prev.error : null,
          }))
        }
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm department completion</DialogTitle>
            <div className="text-sm text-muted-foreground">
              This records the current department as complete and follows the saved production route.
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Next production state</div>
              <div className="font-medium text-foreground">
                {departmentCompletionPreview}
              </div>
            </div>
            {submitConfirmDialog.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submitConfirmDialog.error}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSubmitConfirmDialog({ open: false, destinationDepartmentId: '', note: '', error: null })}>
              Back
            </Button>
            <Button type="button" onClick={() => void handleSubmitDepartmentComplete()} disabled={timerSaving}>
              {timerSaving ? 'Moving…' : 'Yes, submit it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
        <div className="flex min-h-0 flex-col">
          <div className="pb-2 lg:sticky lg:top-0 lg:z-10 lg:pb-3">
            <div className="flex items-end justify-between gap-3 lg:min-h-[70px]">
              <span className="text-2xl font-semibold text-foreground">PARTS</span>
              <span className="pb-1 text-xs text-muted-foreground">
                {timerLoading ? 'Refreshing…' : `${parts.length} total`}
              </span>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 lg:space-y-3 lg:overflow-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Parts</span>
              <span>{selectedPartId ? 'Select a part to inspect details' : 'Choose a part to begin'}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 pr-1 lg:block lg:max-h-[calc(100vh-260px)] lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
              {parts.map((part: any, index: number) => {
                const isSelected = part.id === selectedPartId;
                const partLabel = part.partNumber || `Part ${index + 1}`;
                const totalSeconds = partTotals[part.id] ?? 0;
                const status = part.status || 'IN_PROGRESS';
                const partCurrentDepartment =
                  departments.find((department) => department.id === part.currentDepartmentId)?.name ??
                  part.currentDepartmentId ??
                  'Unassigned';
                const latestMetaRaw = part?.partEvents?.[0]?.meta;
                const latestMeta = typeof latestMetaRaw === 'string' ? (() => { try { return JSON.parse(latestMetaRaw); } catch { return null; } })() : latestMetaRaw;
                const flagged = latestMeta?.flag === true;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => selectPart(part.id)}
                    className={`relative isolate w-full min-w-[min(18rem,calc(100vw-2rem))] rounded-lg border px-3 py-3 text-left transition-[border-color,box-shadow,background-color] duration-200 lg:min-w-0 ${
                      isSelected
                        ? 'border-sky-400/80 bg-[linear-gradient(145deg,rgba(38,82,162,0.96),rgba(17,52,106,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_30px_rgba(0,0,0,0.22)]'
                        : 'border-white/20 bg-[linear-gradient(145deg,rgba(21,55,104,0.94),rgba(8,34,68,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_10px_24px_rgba(0,0,0,0.18)] hover:border-sky-300/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_26px_rgba(0,0,0,0.22)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{partLabel}</div>
                        <div className="text-xs text-slate-300">Qty {part.quantity ?? 1}</div>
                        <div className="text-xs text-slate-300">Current dept: {partCurrentDepartment}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusBadgeStyles[status] || 'bg-muted text-foreground'}>{status}</Badge>
                        {flagged ? <Badge variant="destructive" title={typeof latestMeta?.reasonText === 'string' ? latestMeta.reasonText : 'Rework / manual backward move'}>REWORK</Badge> : null}
                        <span className="text-xs text-slate-300">
                          {formatDuration(totalSeconds)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Card className="min-w-0 flex flex-col rounded-none border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-3 px-0 pb-0 pt-1 sm:px-6 sm:pb-0 sm:pt-6">
            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{orderTitle}</div>
                <div className="text-2xl font-semibold text-foreground">{item.customer?.name ?? 'Customer'}</div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 [&>*:last-child]:col-span-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:[&>*:last-child]:col-span-1">
                {canEditParts ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveRepeatTemplate({ launch: true })}
                    disabled={repeatTemplateSaving || !selectedPartId}
                    className="h-auto min-h-9 w-full whitespace-normal sm:w-auto"
                  >
                    {repeatTemplateSaving ? 'Preparing...' : 'Create again'}
                  </Button>
                ) : null}
                {canEditParts ? (
                  <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 w-full whitespace-normal sm:w-auto" onClick={() => setRepeatTemplateDialogOpen(true)}>
                    Save repeat template
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm" className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
                  <Link href={`/orders/${id}/print`}>
                    <Printer className="h-4 w-4" />
                    Print traveler
                  </Link>
                </Button>
                {canEditParts ? (
                  <Button type="button" variant={editMode ? 'secondary' : 'outline'} size="sm" className="h-auto min-h-9 w-full whitespace-normal sm:w-auto" onClick={() => setEditMode((prev) => !prev)}>
                    {editMode ? 'Exit edit mode' : 'Edit order'}
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm" className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
                  <Link href="/">Exit Order</Link>
                </Button>
              </div>
            </div>
            <div className="order-detail-tile flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <Badge className={statusBadgeStyles[item.status || 'RECEIVED'] || 'bg-primary/10 text-primary'}>{statusLabel}</Badge>
                <span className="text-sm text-muted-foreground">Due {dueDateLabel}</span>
                {canEditOrderStatus ? (
                  <>
                    <div className="col-span-2 flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 sm:col-span-1 sm:w-auto">
                      <Label htmlFor="order-header-priority" className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Priority</Label>
                      <Select value={item.priority ?? 'NORMAL'} onValueChange={(value) => void handlePriorityChange(value)} disabled={prioritySaving}>
                        <SelectTrigger id="order-header-priority" className="h-7 flex-1 border-0 bg-transparent px-2 text-xs shadow-none sm:w-28 sm:flex-none"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="RUSH">Rush</SelectItem>
                          <SelectItem value="HOT">Hot</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="col-span-2 h-9 w-full sm:col-span-1 sm:w-auto"
                      onClick={() => setStatusChangeDialog({
                        open: true,
                        status: item.status ?? 'RECEIVED',
                        reason: '',
                        saving: false,
                        error: null,
                      })}
                    >
                      Change status
                    </Button>
                  </>
                ) : null}
              </div>
              {savedRepeatTemplate ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{savedRepeatTemplate.name}</p>
                    <p className="text-muted-foreground">
                      Customer-part template saved. Launch the next reorder without rebuilding its manufacturing setup.
                    </p>
                  </div>
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={`/orders/new?templateId=${savedRepeatTemplate.id}`}>Create again</Link>
                  </Button>
                </div>
              ) : null}
              <OrderTimerConsole
                selectedPart={selectedPart}
                selectedPartId={selectedPartId}
                selectedPartElapsedSeconds={selectedPartElapsedSeconds}
                activeOnSelected={activeOnSelected}
                activeElsewhereEntry={activeElsewhereEntry}
                otherTimerBadgeLabel={otherTimerBadgeLabel}
                hasActiveEntry={hasActiveEntry}
                selectedPartActiveTimers={selectedPartActiveTimers}
                nowMs={nowMs}
                selectedCurrentDepartment={selectedCurrentDepartment}
                selectedTimerWorkerId={selectedTimerWorkerId}
                timerWorkerOptions={timerWorkerOptions}
                timerSaving={timerSaving}
                selectedPartCurrentDepartmentId={selectedPartCurrentDepartmentId}
                canStartSelectedPartTimer={canStartSelectedPartTimer}
                canSubmitCurrentDepartment={canSubmitCurrentDepartment}
                departmentSubmitBlocker={departmentSubmitBlocker}
                submitDestinationOptions={submitDestinationOptions}
                canMarkPartComplete={canMarkPartComplete}
                timerReadOnlyMessage={timerReadOnlyMessage}
                timerError={timerError}
                showTimerDetails={showTimerDetails}
                canUseTimerControls={canUseTimerControls}
                startHelperLabel={startHelperLabel}
                kioskHelperLabel={kioskHelperLabel}
                kioskSession={kioskSession}
                selectedPartStoredSeconds={selectedPartStoredSeconds}
                selectedPartTimerSeconds={selectedPartTimerSeconds}
                selectedPartManualSeconds={selectedPartManualSeconds}
                partManualAdjustments={partManualAdjustments}
                selectedPartDepartmentHistory={selectedPartDepartmentHistory}
                lastPartEvent={lastPartEvent}
                onOpenActiveTimer={handleOpenActiveTimerChip}
                onTimerWorkerChange={setSelectedTimerWorkerId}
                onStartTimer={handleOpenTimerStartDialog}
                onSubmitDepartment={() => void handleBeginSubmitDepartmentComplete()}
                onMoveDepartment={openMoveDepartmentDialog}
                onCompletePart={() => { if (selectedPartId && !timerSaving && canMarkPartComplete) void handleCompleteSelectedPart(); }}
                onToggleDetails={() => setShowTimerDetails((current) => !current)}
              />
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto whitespace-nowrap rounded-md bg-muted/20 p-1 sm:gap-2">
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
          <CardContent className="space-y-6 px-0 pb-6 pt-4 sm:px-6 sm:pt-6">
            {activeTab === 'overview' && (
              <div className="space-y-4 text-sm">
                <PartOverviewDetails
                  customerName={item.customer?.name}
                  dueDateLabel={dueDateLabel}
                  orderPriority={item.priority}
                  selectedCurrentDepartment={selectedCurrentDepartment}
                  selectedPart={selectedPart}
                  canEditMaterialStatus={canEditParts}
                  materialStatusSaving={materialStatusSaving}
                  onMaterialStatusChange={(value) => void handleQuickMaterialStatusChange(value)}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <PartInstructionsPanel
                    acknowledgedReceipts={selectedPartAcknowledgedReceipts}
                    acknowledgedWorkers={acknowledgedWorkers}
                    currentDepartmentName={selectedCurrentDepartment?.name}
                    currentUserName={currentUserName}
                    instructionReceipt={selectedPartInstructionReceipt}
                    instructionSections={selectedPartInstructionSections}
                    instructions={selectedPartInstructions}
                    instructionsVersion={selectedPartInstructionsVersion}
                    requiresInstructionGate={selectedPartRequiresInstructionGate}
                    unacknowledgedWorkers={unacknowledgedWorkers}
                    canAcknowledge={Boolean(selectedPartInstructions && selectedPartCurrentDepartmentId)}
                    onOpen={() => setInstructionGateDialog({ open: true, loading: false, error: null, pendingAction: null, workerId: currentUserId || timerWorkerOptions[0]?.id || '' })}
                  />
                  <PartWorkerAssignmentsPanel
                    assignments={selectedPartAssignments}
                    availableWorkers={availableAssignmentUsers}
                    canEdit={canEditParts}
                    selectedWorkerId={assignmentUserId}
                    saving={assignmentSaving}
                    error={assignmentError}
                    onSelectedWorkerIdChange={setAssignmentUserId}
                    onAdd={handleAssignWorkerToSelectedPart}
                    onRemove={handleRemoveWorkerAssignment}
                  />
                </div>
                {editMode && canEditParts ? (
                  <div className="order-detail-tile space-y-4 rounded-lg border p-4">
                    <OrderHeaderEditor draft={orderDraft} setDraft={setOrderDraft} customers={customers} vendors={vendors} machinists={machinists} saving={savingOrderDetails} onSave={handleSaveOrderDetails} />
                    {selectedPart ? (
                      <SelectedPartEditor
                        draft={partDraft}
                        setDraft={setPartDraft}
                        materials={materials}
                        vendors={vendors}
                        saving={savingPartDetails}
                        canDelete={parts.length > 1}
                        onAdd={handleAddPart}
                        onDelete={handleDeleteSelectedPart}
                        onSave={handleSavePartDetails}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'notes' && (
              <PartNotesAndFilesPanel
                notes={item.notes ?? []}
                noteText={noteText}
                attachments={selectedAttachments}
                canEdit={canEditParts}
                attachment={attachmentForm}
                attachmentSaving={attachmentSaving}
                attachmentFileKey={attachmentFileKey}
                attachmentFileName={attachmentFileName}
                attachmentError={attachmentError}
                onNoteTextChange={setNoteText}
                onAddNote={handleAddNote}
                onAttachmentChange={(patch) => {
                  setAttachmentForm((current) => ({
                    ...current,
                    ...patch,
                    storagePath: patch.url?.trim().length ? '' : current.storagePath,
                  }));
                  setAttachmentError(null);
                }}
                onAttachmentFileChange={(files) => void handleAttachmentFile(files)}
                onAddAttachment={handleAddAttachment}
              />
            )}

            {activeTab === 'full-files' && canEditParts && (
              <FullOrderFilesPanel attachments={fullOrderFiles} />
            )}

            {activeTab === 'checklist' && (
              <OrderChecklistPanel
                entries={selectedChecklist}
                error={checklistError}
                onToggle={handleChecklistToggle}
              />
            )}

            {activeTab === 'bom' && selectedPartId && (
              <PartBomTab
                orderId={id}
                partId={selectedPartId}
                attachments={selectedAttachments}
              />
            )}


            {activeTab === 'log' && (
              <OrderActivityPanel events={partEvents} laborEntries={selectedPartLaborEntries} loading={eventsLoading} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
