import 'server-only';

import type { DepartmentFeedOrder, DepartmentFeedPart, OrderFilterState, OrderListItem, OrderWithMeta } from './orders.types';
import { findNextDepartmentWithOpenChecklist, isPartReadyForDepartment } from './department-routing';
import {
  normalizeOrderWorkflowStatus,
} from './orders.constants';
import {
  createOrderNote,
  createPartTimeAdjustment,
  createStatusHistoryEntry,
  findAddonById,
  findChargeById,
  findChecklistByAddon,
  findChecklistByCharge,
  findChecklistById,
  findActiveDepartmentById,
  findDepartmentById,
  findOrderById,
  findOrderHeader,
  findOrderPart,
  findOrderPartSummary,
  findChecklistByOrderPartDepartment,
  findOrderSummary,
  findOrderWithDetails,
  findPartById,
  findPartForRouting,
  findChecklistForRoutingById,
  findUserSummaryById,
  listPartEventsForPart,
  listPartAssignments,
  findActivePartAssignment,
  createPartAssignment,
  deactivatePartAssignment,
  listInstructionReceiptsForPart,
  findInstructionReceipt,
  createInstructionReceipt,
  listAddons,
  listChecklistItems,
  runInTransaction,
  setChecklistCompletion,
  completePartPreservingDepartment,
  updatePartCurrentDepartment,
  listDepartmentsOrdered,
  listOrderLevelDepartmentChecklistItems,
  listOrderPartsMissingCurrentDepartment,
  listOrderPartsByIds,
  listReadyOrderPartsForDepartment,
  getDashboardOrderOverview,
  searchOrdersByTerm,
  moveOrderPartsToDepartment,
  createOrderChecklistItem,
  updateChecklistCompletion,
  updateOrderChecklistItem,
  deleteOrderChecklistItem,
  updateOrderAssignee,
  updateOrderPart,
  syncChecklistForOrder,
} from '@/repos/orders';
import { listActiveTimeEntriesForPart, listTimeEntriesForPartsDetailed } from '@/repos/time';
import { ensureOrderFilesInCanonicalStorage } from './orders.files.service';
import { recordPartEvent, type PartEventInput } from './orders.events.service';
import {
  createChargeForOrderCommand,
  deleteChargeForOrderCommand,
  listChargesForOrder,
  updateChargeForOrderCommand,
  type OrderChargeCreateInput,
  type OrderChargeUpdateInput,
} from './orders.charges.service';
import { addOrderPartCommand, deleteOrderPartCommand } from './orders.parts.service';
import { syncOrderWorkflowStatus } from './orders.workflow.service';

export { generateNextOrderNumber } from '@/repos/orders';
export { syncChecklistForOrder };
export { listChargesForOrder };
export { createOrderFromPayload } from './orders.create.service';
export { getOrderDetails, listOrdersForQuery } from './orders.query.service';
export type { OrderFilterState, OrderListItem, OrderWithMeta };
export { isPartReadyForDepartment };
export { normalizeOrderWorkflowStatus, ORDER_STATUS_LABELS, ORDER_WORKFLOW_STATUSES } from './orders.constants';
export { deriveWorkflowStatusFromSnapshot, updateOrderWorkflowStatusByAdmin } from './orders.workflow.service';
export { syncOrderWorkflowStatus };
export { decorateOrder, DEFAULT_ORDER_FILTERS, formatStatusLabel, orderMatchesFilters } from './orders.shared';
export type { DepartmentFeedOrder, DepartmentFeedPart };

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DepartmentSortEntry = { id: string; name?: string | null; sortOrder: number };

export function selectDepartmentForPart(
  checklistItems: Array<{
    departmentId?: string | null;
    isActive?: boolean | null;
    completed?: boolean | null;
    addon?: { isChecklistItem?: boolean | null } | null;
    charge?: { addon?: { isChecklistItem?: boolean | null } | null } | null;
  }>,
  departments: DepartmentSortEntry[],
) {
  if (!checklistItems.length) return null;
  const scopedItems = checklistItems.filter((item) => isChecklistRoutingItem(item));
  for (const department of departments) {
    const entries = scopedItems.filter((item) => item.departmentId === department.id);
    if (!entries.length) continue;
    const hasIncomplete = entries.some((item) => item.completed === false);
    if (hasIncomplete) return department.id;
  }
  return null;
}


function isChecklistRoutingItem(item: {
  isActive?: boolean | null;
  addon?: { isChecklistItem?: boolean | null } | null;
  charge?: { addon?: { isChecklistItem?: boolean | null } | null } | null;
}) {
  if (item.isActive === false) return false;
  return item.addon?.isChecklistItem === true || item.charge?.addon?.isChecklistItem === true;
}

function isBackwardsMove(fromDepartmentId: string | null | undefined, toDepartmentId: string | null | undefined, departments: DepartmentSortEntry[]) {
  if (!fromDepartmentId || !toDepartmentId) return false;
  const rank = new Map(departments.map((dept, idx) => [dept.id, dept.sortOrder ?? idx]));
  const fromRank = rank.get(fromDepartmentId);
  const toRank = rank.get(toDepartmentId);
  if (typeof fromRank !== 'number' || typeof toRank !== 'number') return false;
  return toRank < fromRank;
}

function getDepartmentName(departments: DepartmentSortEntry[], departmentId: string | null | undefined) {
  if (!departmentId) return 'Done';
  return departments.find((dept) => dept.id === departmentId)?.name ?? departmentId;
}

function getUserLabel(user: { id?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.name?.trim() || user?.email?.trim() || user?.id || 'Unknown user';
}

function hasWorkInstructions(part: { workInstructions?: string | null }) {
  return Boolean(part.workInstructions?.trim());
}

function buildChecklistAudit({
  checked,
  label,
  actorUserId,
  actorLabel,
  performerUserId,
  performerLabel,
}: {
  checked: boolean;
  label: string;
  actorUserId?: string | null;
  actorLabel: string;
  performerUserId?: string | null;
  performerLabel: string;
}) {
  const actorIsPerformer = !actorUserId || !performerUserId || actorUserId === performerUserId;
  return {
    historyReason: actorIsPerformer
      ? `Checklist "${label}" ${checked ? 'checked' : 'unchecked'} by ${performerLabel}`
      : `Checklist "${label}" ${checked ? 'checked' : 'unchecked'} by ${actorLabel} for ${performerLabel}`,
    eventMessage: actorIsPerformer
      ? `${performerLabel} ${checked ? 'checked' : 'unchecked'} ${label}.`
      : `${actorLabel} marked ${performerLabel} as ${checked ? 'completing' : 'undoing'} ${label}.`,
  };
}

function buildPartActivityByPart(
  partIds: string[],
  entries: Array<{
    id: string;
    orderId: string;
    partId: string | null;
    departmentId: string | null;
    userId: string;
    operation: string | null;
    startedAt: Date;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; name?: string | null; email?: string | null; active?: boolean | null } | null;
    department?: { id: string; name?: string | null } | null;
  }>,
) {
  const partIdSet = new Set(partIds);
  const activityByPart = Object.fromEntries(
    partIds.map((partId) => [
      partId,
      {
        activeTimers: [] as Array<Record<string, unknown>>,
        timeByUser: [] as Array<Record<string, unknown>>,
        totalSeconds: 0,
      },
    ]),
  ) as Record<string, { activeTimers: Array<Record<string, unknown>>; timeByUser: Array<Record<string, unknown>>; totalSeconds: number }>;

  const totalsByPartUser = new Map<string, { partId: string; user: { id: string; name?: string | null; email?: string | null; active?: boolean | null } | null; seconds: number }>();

  entries.forEach((entry) => {
    if (!entry.partId || !partIdSet.has(entry.partId)) return;
    const bucket = activityByPart[entry.partId];
    if (!bucket) return;

    if (!entry.endedAt) {
      bucket.activeTimers.push({
        id: entry.id,
        orderId: entry.orderId,
        partId: entry.partId,
        departmentId: entry.departmentId,
        departmentName: entry.department?.name ?? null,
        userId: entry.userId,
        user: entry.user ?? null,
        operation: entry.operation ?? null,
        startedAt: entry.startedAt,
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)),
      });
      return;
    }

    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return;

    const seconds = Math.floor(diffMs / 1000);
    bucket.totalSeconds += seconds;
    const mapKey = `${entry.partId}:${entry.userId}`;
    const existing = totalsByPartUser.get(mapKey);
    if (existing) {
      existing.seconds += seconds;
      return;
    }

    totalsByPartUser.set(mapKey, {
      partId: entry.partId,
      user: entry.user ?? null,
      seconds,
    });
  });

  totalsByPartUser.forEach((entry) => {
    activityByPart[entry.partId]?.timeByUser.push({
      userId: entry.user?.id ?? null,
      user: entry.user ?? null,
      seconds: entry.seconds,
    });
  });

  Object.values(activityByPart).forEach((entry) => {
    entry.activeTimers.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    entry.timeByUser.sort((a: any, b: any) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      const aLabel = getUserLabel(a.user ?? null);
      const bLabel = getUserLabel(b.user ?? null);
      return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
    });
  });

  return activityByPart;
}

async function requireInstructionAcknowledgement({
  orderId,
  partId,
  userId,
  departmentId,
}: {
  orderId: string;
  partId: string;
  userId?: string | null;
  departmentId?: string | null;
}) {
  if (!userId) return fail(401, 'Unauthorized');
  if (!departmentId) return ok({ required: false, receipt: null, part: null });

  const part = await findPartForRouting(partId);
  if (!part || part.orderId !== orderId) return fail(404, 'Part not found');
  if (!hasWorkInstructions(part)) return ok({ required: false, receipt: null, part });

  const receipt = await findInstructionReceipt({
    partId,
    userId,
    departmentId,
    instructionsVersion: Math.max(1, Number(part.instructionsVersion ?? 1)),
  });

  if (receipt) {
    return ok({ required: false, receipt, part });
  }

  return fail(409, {
    code: 'INSTRUCTION_ACK_REQUIRED',
    message: 'Read and acknowledge the part instructions before continuing.',
    partId,
    departmentId,
    instructionsVersion: Math.max(1, Number(part.instructionsVersion ?? 1)),
    workInstructions: part.workInstructions ?? '',
  });
}

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

export { ensureOrderFilesInCanonicalStorage };

export { updateOrderDetails } from './orders.header.service';

export async function assignMachinistToOrder(orderId: string, machinistId: string | null) {
  const order = await updateOrderAssignee(orderId, machinistId);
  return ok({ item: order });
}

export async function listPartWorkers(orderId: string, partId: string) {
  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found');
  const assignments = await listPartAssignments(partId);
  return ok({ assignments });
}

export async function assignWorkerToPart({
  orderId,
  partId,
  userId,
  assignedById,
  assignmentType,
}: {
  orderId: string;
  partId: string;
  userId: string;
  assignedById?: string | null;
  assignmentType?: string;
}) {
  const [part, worker, existing] = await Promise.all([
    findOrderPart(orderId, partId),
    findUserSummaryById(userId),
    findActivePartAssignment(partId, userId),
  ]);
  if (!part) return fail(404, 'Part not found');
  if (!worker || worker.active === false) return fail(404, 'Worker not found');
  if (existing) return ok({ assignment: existing, created: false });

  const assignment = await createPartAssignment({ partId, userId, assignedById, assignmentType });
  await recordPartEvent({
    orderId,
    partId,
    userId: assignedById ?? null,
    type: 'PART_WORKER_ASSIGNED',
    message: `${getUserLabel(worker)} assigned to part.`,
    meta: { assignmentId: assignment.id, assignedUserId: worker.id, assignmentType: assignment.assignmentType },
  });
  return ok({ assignment, created: true });
}

export async function removeWorkerFromPart({
  orderId,
  partId,
  assignmentId,
  removedById,
}: {
  orderId: string;
  partId: string;
  assignmentId: string;
  removedById?: string | null;
}) {
  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found');

  const assignments = await listPartAssignments(partId);
  const assignment = assignments.find((entry: any) => entry.id === assignmentId);
  if (!assignment) return fail(404, 'Assignment not found');

  const removed = await deactivatePartAssignment(assignmentId);
  await recordPartEvent({
    orderId,
    partId,
    userId: removedById ?? null,
    type: 'PART_WORKER_REMOVED',
    message: `${getUserLabel(assignment.user)} removed from part.`,
    meta: { assignmentId: removed.id, removedUserId: assignment.userId },
  });
  return ok({ assignment: removed });
}

export async function acknowledgePartInstructions({
  orderId,
  partId,
  departmentId,
  userId,
  actorUserId,
}: {
  orderId: string;
  partId: string;
  departmentId: string;
  userId: string;
  actorUserId?: string | null;
}) {
  const part = await findPartForRouting(partId);
  if (!part || part.orderId !== orderId) return fail(404, 'Part not found');
  if (!departmentId) return fail(400, 'Department is required');
  if (!hasWorkInstructions(part)) return fail(400, 'This part has no required instructions.');

  const instructionsVersion = Math.max(1, Number(part.instructionsVersion ?? 1));
  const existing = await findInstructionReceipt({ partId, userId, departmentId, instructionsVersion });
  if (existing) return ok({ receipt: existing, created: false });

  const receipt = await createInstructionReceipt({ partId, userId, departmentId, instructionsVersion });
  await recordPartEvent({
    orderId,
    partId,
    userId: actorUserId ?? userId,
    type: 'PART_INSTRUCTIONS_ACKNOWLEDGED',
    message: 'Part instructions acknowledged.',
    meta: {
      departmentId,
      instructionsVersion,
      receiptId: receipt.id,
      acknowledgedForUserId: userId,
      acknowledgementSource: actorUserId && actorUserId !== userId ? 'dispatch_console' : 'self',
    },
  });
  return ok({ receipt, created: true });
}

export async function getPartInstructionStatus({
  orderId,
  partId,
  userId,
}: {
  orderId: string;
  partId: string;
  userId?: string | null;
}) {
  const part = await findPartForRouting(partId);
  if (!part || part.orderId !== orderId) return fail(404, 'Part not found');

  const receipts = await listInstructionReceiptsForPart(partId);
  const activeReceipt =
    userId && part.currentDepartmentId
      ? receipts.find(
          (receipt: any) =>
            receipt.userId === userId &&
            receipt.departmentId === part.currentDepartmentId &&
            receipt.instructionsVersion === Math.max(1, Number(part.instructionsVersion ?? 1)),
        ) ?? null
      : null;

  return ok({
    partId,
    currentDepartmentId: part.currentDepartmentId ?? null,
    workInstructions: part.workInstructions ?? '',
    instructionsVersion: Math.max(1, Number(part.instructionsVersion ?? 1)),
    requiresAcknowledgement: hasWorkInstructions(part),
    activeReceipt,
    receipts,
  });
}

export async function requirePartInstructionAcknowledgement(input: {
  orderId: string;
  partId: string;
  userId?: string | null;
  departmentId?: string | null;
}) {
  return requireInstructionAcknowledgement(input);
}


export async function addOrderNote(
  orderId: string,
  userId: string,
  content: string,
  partId?: string | null
) {
  if (partId) {
    const part = await findOrderPart(orderId, partId);
    if (!part) {
      return fail(404, 'Part not found');
    }
  }

  const note = await createOrderNote(orderId, userId, content.trim());
  if (partId) {
    await recordPartEvent({
      orderId,
      partId,
      userId,
      type: 'NOTE_ADDED',
      message: 'Note added.',
      meta: { noteId: note.id },
    });
  }
  return ok({ note });
}

export async function recomputePartDepartment(
  partId: string,
  {
    actorUserId,
    reasonCode,
    reasonText,
    transitionType,
    tx,
  }: {
    actorUserId?: string | null;
    reasonCode?: string;
    reasonText?: string;
    transitionType?: 'auto' | 'manual';
    tx?: any;
  } = {},
) {
  if (!partId) return fail(400, 'Part is required');
  const departments = await listDepartmentsOrdered(tx);
  const part = await findPartForRouting(partId, tx);
  if (!part) return fail(404, 'Part not found');

  const fromDepartmentId = part.currentDepartmentId ?? null;
  const toDepartmentId = selectDepartmentForPart(part.checklistItems ?? [], departments);
  const desiredPartStatus = toDepartmentId ? 'IN_PROGRESS' : 'COMPLETE';

  if (fromDepartmentId === toDepartmentId) {
    if (part.status !== desiredPartStatus) {
      await updateOrderPart(partId, { status: desiredPartStatus });
      return ok({ partId, orderId: part.orderId, currentDepartmentId: fromDepartmentId, changed: true, flagged: false });
    }
    return ok({ partId, orderId: part.orderId, currentDepartmentId: fromDepartmentId, changed: false, flagged: false });
  }

  const backwards = isBackwardsMove(fromDepartmentId, toDepartmentId, departments);
  const manual = transitionType === 'manual';
  if ((manual || backwards) && !reasonCode && !reasonText?.trim()) {
    return fail(400, 'Reason is required for rework/backward/manual department transitions.');
  }

  if (toDepartmentId) {
    await updatePartCurrentDepartment(partId, toDepartmentId, tx);
  } else {
    if (tx?.orderPart) {
      await tx.orderPart.update({
        where: { id: partId },
        data: { status: 'COMPLETE' },
      });
    } else {
      await updateOrderPart(partId, { status: 'COMPLETE' });
    }
  }

  let type = 'DEPARTMENT_ADVANCED';
  if (manual) type = 'DEPARTMENT_SET_MANUAL';
  else if (backwards) type = 'DEPARTMENT_REWORKED';

  const fromLabel = getDepartmentName(departments, fromDepartmentId);
  const toLabel = getDepartmentName(departments, toDepartmentId);
  const flagged = backwards || (manual && backwards);

  await recordPartEvent({
    orderId: part.orderId,
    partId,
    userId: actorUserId ?? null,
    type,
    message: `Department moved from ${fromLabel} to ${toLabel}.`,
    meta: {
      fromDepartmentId,
      toDepartmentId,
      reasonCode: reasonCode ?? null,
      reasonText: reasonText?.trim() || null,
      flag: flagged,
      transitionType: manual ? 'manual' : backwards ? 'rework' : 'auto',
    },
  }, tx);

  return ok({ partId, orderId: part.orderId, currentDepartmentId: toDepartmentId ?? fromDepartmentId, changed: true, flagged });
}

export async function previewChecklistComplete({ orderId, partId, checklistId }: { orderId: string; partId: string; checklistId: string }) {
  const departments = await listDepartmentsOrdered();
  const checklist = await findChecklistForRoutingById(checklistId);
  if (!checklist || checklist.orderId !== orderId || checklist.partId !== partId) return fail(404, 'Checklist item not found');
  const part = checklist.part;
  if (!part) return fail(404, 'Part not found');

  const currentDepartmentId = part.currentDepartmentId ?? selectDepartmentForPart(part.checklistItems ?? [], departments);
  const simulatedItems = (part.checklistItems ?? []).map((item) =>
    item.id === checklistId ? { ...item, completed: true } : item,
  );
  const nextDepartmentId = selectDepartmentForPart(simulatedItems, departments);

  const willCompleteDepartment = Boolean(currentDepartmentId) &&
    !simulatedItems.some(
      (item) => item.departmentId === currentDepartmentId && isChecklistRoutingItem(item) && item.completed === false,
    );

  return ok({
    willCompleteDepartment,
    currentDepartmentId: currentDepartmentId ?? null,
    currentDepartmentName: getDepartmentName(departments, currentDepartmentId ?? null),
    nextDepartmentId: nextDepartmentId ?? null,
    nextDepartmentName: getDepartmentName(departments, nextDepartmentId ?? null),
    doneIfConfirmed: nextDepartmentId === null,
  });
}

export async function completeChecklistAndAdvance({
  orderId,
  partId,
  checklistId,
  actorUserId,
  performedById,
}: {
  orderId: string;
  partId: string;
  checklistId: string;
  actorUserId?: string;
  performedById?: string | null;
}) {
  const checklist = await findChecklistForRoutingById(checklistId);
  if (!checklist || checklist.orderId !== orderId || checklist.partId !== partId) return fail(404, 'Checklist item not found');
  const actor = actorUserId ? await findUserSummaryById(actorUserId) : null;
  if (actorUserId && !actor) return fail(404, 'Actor not found');
  const performer = performedById
    ? await findUserSummaryById(performedById)
    : actor;
  if (performedById && !performer) return fail(404, 'Performer not found');
  const finalPerformedById = performer?.id ?? actor?.id ?? null;
  const actorLabel = getUserLabel(actor);
  const performerLabel = getUserLabel(performer ?? actor);
  const checklistLabel = checklist.charge?.name ?? checklist.addon?.name ?? 'Checklist';
  const audit = buildChecklistAudit({
    checked: true,
    label: checklistLabel,
    actorUserId: actor?.id ?? null,
    actorLabel,
    performerUserId: finalPerformedById,
    performerLabel,
  });

  const ackResult = await requireInstructionAcknowledgement({
    orderId,
    partId,
    userId: actorUserId ?? null,
    departmentId: checklist.departmentId ?? checklist.part?.currentDepartmentId ?? null,
  });
  if (ackResult.ok === false) return ackResult;

  const result = await runInTransaction(async (tx) => {
    const checklist = await findChecklistForRoutingById(checklistId, tx);
    if (!checklist || checklist.orderId !== orderId || checklist.partId !== partId) {
      throw new Error('CHECKLIST_NOT_FOUND');
    }

    await setChecklistCompletion({
      checklistId,
      checked: true,
      toggledById: actorUserId ?? null,
      performedById: finalPerformedById,
      chargeId: checklist.chargeId,
    }, tx);
    const recompute = await recomputePartDepartment(partId, { actorUserId, tx });
    if (recompute.ok === false) {
      throw new Error(typeof recompute.error === 'string' ? recompute.error : 'Failed to recompute department');
    }
    return recompute.data;
  }).catch((error: any) => {
    if (error?.message === 'CHECKLIST_NOT_FOUND') return null;
    throw error;
  });

  if (!result) return fail(404, 'Checklist item not found');
  await createStatusHistoryEntry({
    orderId,
    from: `${checklistLabel} unchecked`,
    to: `${checklistLabel} checked`,
    userId: actor?.id ?? undefined,
    reason: audit.historyReason,
  });
  await recordPartEvent({
    orderId,
    partId,
    userId: actor?.id ?? null,
    type: 'CHECKLIST_TOGGLED',
    message: audit.eventMessage,
    meta: {
      checklistId,
      checklistLabel,
      checked: true,
      actorUserId: actor?.id ?? null,
      actorLabel,
      performedById: finalPerformedById,
      performedByLabel: performerLabel,
      chargeId: checklist.chargeId ?? null,
      addonId: checklist.addonId ?? null,
      departmentId: checklist.departmentId ?? null,
    },
  });
  await syncOrderWorkflowStatus(orderId, { userId: actorUserId ?? null });
  return ok({ part: { id: partId, currentDepartmentId: result.currentDepartmentId, flagged: result.flagged } });
}

export async function toggleChecklistItem({
  orderId,
  checklistId,
  chargeId,
  addonId,
  partId,
  checked,
  performedById,
  employeeName,
  togglerId,
  reasonCode,
  reasonText,
}: {
  orderId: string;
  checklistId?: string;
  chargeId?: string;
  addonId?: string;
  partId?: string;
  checked: boolean;
  performedById?: string | null;
  employeeName?: string;
  togglerId?: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  if (!checklistId && !chargeId && !addonId) return fail(400, 'Missing checklistId');
  if (typeof checked !== 'boolean') return fail(400, 'Missing checked state');

  const orderExists = await findOrderById(orderId);
  if (!orderExists) return fail(404, 'Order not found');

  const existingChecklist = checklistId
    ? await findChecklistById(checklistId)
    : chargeId
      ? await findChecklistByCharge(orderId, chargeId)
      : await findChecklistByAddon(orderId, addonId as string, typeof partId === 'string' ? partId : null);
  if (!existingChecklist || existingChecklist.orderId !== orderId) return fail(404, 'Checklist item not found');
  if (existingChecklist.departmentId && !existingChecklist.partId) return fail(400, 'Department checklist items must be tied to a part.');

  const charge = existingChecklist.chargeId ? await findChargeById(existingChecklist.chargeId) : null;
  const addonExists = existingChecklist.addonId ? await findAddonById(existingChecklist.addonId) : null;
  if (existingChecklist.chargeId && !charge) return fail(404, 'Charge not found');
  if (existingChecklist.addonId && !addonExists) return fail(404, 'Addon not found');

  const previousState = existingChecklist.completed ?? false;
  const toggler = togglerId ? await findUserSummaryById(togglerId) : null;
  const toggledById = toggler ? toggler.id : null;
  const performer = performedById ? await findUserSummaryById(performedById) : toggler;
  if (performedById && !performer) return fail(404, 'Performer not found');
  const finalPerformedById = performer?.id ?? toggledById ?? null;

  if (existingChecklist.partId) {
    const ackResult = await requireInstructionAcknowledgement({
      orderId,
      partId: existingChecklist.partId,
      userId: toggledById ?? null,
      departmentId: existingChecklist.departmentId ?? null,
    });
    if (ackResult.ok === false) return ackResult;
  }

  await setChecklistCompletion({
    checklistId: existingChecklist.id,
    checked,
    toggledById,
    performedById: finalPerformedById,
    chargeId: existingChecklist.chargeId,
  });

  const label = charge?.name ?? addonExists?.name ?? 'Checklist';
  const togglerLabel = employeeName?.trim() || getUserLabel(toggler) || toggledById || 'Unknown user';
  const performerLabel = performer ? getUserLabel(performer) : togglerLabel;
  const audit = buildChecklistAudit({
    checked,
    label,
    actorUserId: toggledById,
    actorLabel: togglerLabel,
    performerUserId: finalPerformedById,
    performerLabel,
  });

  await createStatusHistoryEntry({
    orderId,
    from: `${label} ${previousState ? 'checked' : 'unchecked'}`,
    to: `${label} ${checked ? 'checked' : 'unchecked'}`,
    userId: toggledById ?? undefined,
    reason: audit.historyReason,
  });

  if (existingChecklist.partId) {
    await recordPartEvent({
      orderId,
      partId: existingChecklist.partId,
      userId: toggledById ?? undefined,
      type: 'CHECKLIST_TOGGLED',
      message: audit.eventMessage,
      meta: {
        checklistId: existingChecklist.id,
        checklistLabel: label,
        checked,
        actorUserId: toggledById,
        actorLabel: togglerLabel,
        performedById: finalPerformedById,
        performedByLabel: performerLabel,
        toggledById,
        chargeId: existingChecklist.chargeId ?? null,
        addonId: existingChecklist.addonId ?? null,
        departmentId: existingChecklist.departmentId ?? null,
      },
    });

  }

  await syncOrderWorkflowStatus(orderId, { userId: toggledById ?? undefined });
  return ok({ ok: true });
}

export async function listChecklistForOrder(orderId: string) {
  const items = await listChecklistItems(orderId);
  const sanitized = items.map(({ addon, ...item }) => ({
    ...item,
    addon: addon ? (({ rateCents: _, ...rest }) => rest)(addon) : addon,
  }));
  return ok({ items: sanitized });
}

async function initializeCurrentDepartmentForParts({ orderId }: { orderId?: string } = {}) {
  const departments = await listDepartmentsOrdered();
  if (!departments.length) return { updatedCount: 0 };

  const parts = await listOrderPartsMissingCurrentDepartment(orderId);
  let updatedCount = 0;

  for (const part of parts) {
    if (part.status === 'COMPLETE') continue;
    const targetDepartmentId = departments[0]?.id ?? null;
    if (!targetDepartmentId) continue;
    await updateOrderPart(part.id, { currentDepartmentId: targetDepartmentId, status: 'IN_PROGRESS' });
    updatedCount += 1;
  }

  return { updatedCount };
}

export async function initializeCurrentDepartmentForOrder(orderId: string) {
  const result = await initializeCurrentDepartmentForParts({ orderId });
  return ok({ orderId, updatedCount: result.updatedCount });
}

export async function backfillCurrentDepartmentIds() {
  const result = await initializeCurrentDepartmentForParts();
  return ok({ updatedCount: result.updatedCount });
}

export async function migrateOrderLevelDepartmentChecklistsToParts() {
  const items = await listOrderLevelDepartmentChecklistItems();
  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  for (const item of items) {
    const departmentId = item.departmentId;
    if (!departmentId) continue;

    if (item.chargeId) {
      const chargePartId = item.charge?.partId ?? null;
      if (chargePartId) {
        if (item.partId !== chargePartId) {
          await updateOrderChecklistItem(item.id, { partId: chargePartId });
          updatedCount += 1;
        }
      } else {
        await deleteOrderChecklistItem(item.id);
        deletedCount += 1;
      }
      continue;
    }

    const partIds = item.order?.parts?.map((part) => part.id) ?? [];
    for (const partId of partIds) {
      const existing = await findChecklistByOrderPartDepartment({
        orderId: item.orderId,
        partId,
        departmentId,
        addonId: item.addonId ?? null,
        chargeId: null,
      });
      if (existing) continue;
      await createOrderChecklistItem({
        orderId: item.orderId,
        partId,
        departmentId,
        addonId: item.addonId ?? null,
        chargeId: null,
        completed: false,
        isActive: item.isActive,
      });
      createdCount += 1;
    }

    await deleteOrderChecklistItem(item.id);
    deletedCount += 1;
  }

  return ok({ createdCount, updatedCount, deletedCount });
}

export async function assignPartDepartment({
  orderId,
  partId,
  departmentId,
  actorUserId,
  reasonCode,
  reasonText,
}: {
  orderId: string;
  partId: string;
  departmentId: string;
  actorUserId?: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  if (!orderId) return fail(400, 'Order is required');
  if (!partId) return fail(400, 'Part is required');
  if (!departmentId) return fail(400, 'Department is required');
  if (!reasonText?.trim()) return fail(400, 'A note is required for manual department transitions.');

  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found for this order');
  const activeTimers = await listActiveTimeEntriesForPart(partId);
  if (activeTimers.length) {
    return fail(409, 'Pause or finish every active employee timer before moving this part.');
  }

  const [department, departments] = await Promise.all([findActiveDepartmentById(departmentId), listDepartmentsOrdered()]);
  if (!department) return fail(400, 'Department not found');

  const fromDepartmentId = part.currentDepartmentId ?? null;
  const isBackward = isBackwardsMove(fromDepartmentId, departmentId, departments);

  await updateOrderPart(part.id, { currentDepartmentId: departmentId, status: 'IN_PROGRESS' });
  await recordPartEvent({
    orderId,
    partId,
    userId: actorUserId ?? null,
    type: 'DEPARTMENT_SET_MANUAL',
    message: `Department manually set to ${department.name ?? departmentId}.`,
    meta: {
      fromDepartmentId,
      toDepartmentId: departmentId,
      reasonCode: reasonCode ?? null,
      reasonText: reasonText?.trim() || null,
      flag: isBackward,
      transitionType: 'manual',
    },
  });
  await syncOrderWorkflowStatus(orderId, { userId: actorUserId ?? null });
  return ok({ ok: true });
}

export async function addOrderPart(
  input: Parameters<typeof addOrderPartCommand>[0],
) {
  return addOrderPartCommand(input, {
    initializeCurrentDepartmentForParts: (orderId) => initializeCurrentDepartmentForParts({ orderId }),
    syncOrderWorkflowStatus: (orderId, userId) => syncOrderWorkflowStatus(orderId, { userId }),
  });
}

export { updateOrderPartDetails } from './orders.parts.service';

export async function deleteOrderPartDetails(
  input: Parameters<typeof deleteOrderPartCommand>[0],
) {
  return deleteOrderPartCommand(input, {
    syncOrderWorkflowStatus: (orderId, userId) => syncOrderWorkflowStatus(orderId, { userId }),
  });
}

export async function createChargeForOrder({
  orderId,
  payload,
}: {
  orderId: string;
  payload: OrderChargeCreateInput;
}) {
  return createChargeForOrderCommand({ orderId, payload }, {
    initializePartDepartments: (id) => initializeCurrentDepartmentForParts({ orderId: id }),
    syncWorkflowStatus: (id) => syncOrderWorkflowStatus(id),
  });
}

export async function updateChargeForOrder({
  orderId,
  chargeId,
  payload,
}: {
  orderId: string;
  chargeId: string;
  payload: OrderChargeUpdateInput;
}) {
  return updateChargeForOrderCommand({ orderId, chargeId, payload }, {
    initializePartDepartments: (id) => initializeCurrentDepartmentForParts({ orderId: id }),
    syncWorkflowStatus: (id) => syncOrderWorkflowStatus(id),
  });
}

export async function deleteChargeForOrder({ orderId, chargeId }: { orderId: string; chargeId: string }) {
  return deleteChargeForOrderCommand({ orderId, chargeId }, {
    syncWorkflowStatus: (id) => syncOrderWorkflowStatus(id),
  });
}

export {
  createAttachmentForOrder,
  createAttachmentForPart,
  deleteAttachmentForPart,
  getPartUploadContext,
  listAttachmentsForPart,
  updateAttachmentForPart,
} from './orders.files.service';



export async function submitDepartmentComplete({
  orderId,
  partId,
  userId,
  additionalSeconds,
  adjustmentNote,
}: {
  orderId: string;
  partId: string;
  userId?: string | null;
  additionalSeconds?: number;
  adjustmentNote?: string;
}) {
  if (additionalSeconds !== undefined) {
    if (!Number.isFinite(additionalSeconds) || additionalSeconds < 0) {
      return fail(400, 'additionalSeconds must be a non-negative number.');
    }
    if (additionalSeconds > 0 && !adjustmentNote?.trim()) {
      return fail(400, 'A note is required when adding extra time.');
    }
  }

  const departments = await listDepartmentsOrdered();
  if (!departments.length) return fail(400, 'No departments configured.');

  const part = await findPartForRouting(partId);
  if (!part || part.orderId !== orderId) return fail(404, 'Part not found');
  const activeTimers = await listActiveTimeEntriesForPart(partId);
  if (activeTimers.length) {
    return fail(409, 'Pause or finish every active employee timer before submitting this department complete.');
  }

  const currentDepartmentId = part.currentDepartmentId ?? findNextDepartmentWithOpenChecklist(part.checklistItems ?? [], departments);
  if (!currentDepartmentId) return fail(409, 'Part has no active department to submit.');

  const ackResult = await requireInstructionAcknowledgement({
    orderId,
    partId,
    userId: userId ?? null,
    departmentId: currentDepartmentId,
  });
  if (ackResult.ok === false) return ackResult;

  const currentDepartmentItems = (part.checklistItems ?? []).filter(
    (item) => item.isActive !== false && item.departmentId === currentDepartmentId,
  );
  if (!currentDepartmentItems.length) {
    return fail(409, 'Current department has no checklist items.');
  }

  const openItems = currentDepartmentItems.filter((item) => item.completed === false);
  if (openItems.length) {
    return fail(409, `Cannot submit department complete: ${openItems.length} checklist item(s) remain open.`);
  }

  const nextDepartmentId = findNextDepartmentWithOpenChecklist(part.checklistItems ?? [], departments);

  const result = await runInTransaction(async (tx) => {
    await recordPartEvent({
      orderId,
      partId,
      userId: userId ?? null,
      type: 'DEPARTMENT_SUBMIT_CONFIRMED',
      message: `Department submit confirmed for ${getDepartmentName(departments, currentDepartmentId)}.`,
      meta: {
        departmentId: currentDepartmentId,
        additionalSeconds: additionalSeconds ?? 0,
        adjustmentNote: adjustmentNote?.trim() || null,
      },
    }, tx);

    if (typeof additionalSeconds === 'number' && additionalSeconds > 0) {
      await createPartTimeAdjustment({
        orderId,
        partId,
        userId: userId ?? null,
        seconds: Math.floor(additionalSeconds),
        note: adjustmentNote?.trim() || 'Additional submitted time.',
      }, tx);
    }

    if (nextDepartmentId) {
      await updatePartCurrentDepartment(partId, nextDepartmentId, tx);
      await recordPartEvent({
        orderId,
        partId,
        userId: userId ?? null,
        type: 'DEPARTMENT_ADVANCED',
        message: `Department submitted complete. Moved to ${getDepartmentName(departments, nextDepartmentId)}.`,
        meta: {
          fromDepartmentId: currentDepartmentId,
          toDepartmentId: nextDepartmentId,
          transitionType: 'manual_submit',
          additionalSeconds: additionalSeconds ?? 0,
          adjustmentNote: adjustmentNote?.trim() || null,
        },
      }, tx);
      return { currentDepartmentId: nextDepartmentId, status: 'IN_PROGRESS' as const };
    }

    await completePartPreservingDepartment(partId, currentDepartmentId, tx);
    await recordPartEvent({
      orderId,
      partId,
      userId: userId ?? null,
      type: 'PART_COMPLETED',
      message: 'All departments submitted complete. Part marked complete.',
      meta: {
        fromDepartmentId: currentDepartmentId,
        toDepartmentId: currentDepartmentId,
        transitionType: 'manual_submit',
        additionalSeconds: additionalSeconds ?? 0,
        adjustmentNote: adjustmentNote?.trim() || null,
      },
    }, tx);
    return { currentDepartmentId, status: 'COMPLETE' as const };
  });

  await syncOrderWorkflowStatus(orderId, { userId: userId ?? null });

  return ok({
    part: {
      id: partId,
      status: result.status,
      currentDepartmentId: result.currentDepartmentId,
    },
  });
}

export async function completeOrderPart({
  orderId,
  partId,
  userId,
}: {
  orderId: string;
  partId: string;
  userId?: string | null;
}) {
  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found');
  const activeTimers = await listActiveTimeEntriesForPart(partId);
  if (activeTimers.length) {
    return fail(409, 'Pause or finish every active employee timer before completing this part.');
  }

  const checklistItems = await listChecklistItems(orderId);
  const hasIncompleteChecklist = checklistItems.some((item: any) => item.partId === partId && item.isActive !== false && item.completed === false);
  if (hasIncompleteChecklist) {
    return fail(409, 'Cannot complete part: checklist items remain.');
  }

  const currentDepartmentId = part.currentDepartmentId ?? null;
  if (!currentDepartmentId) {
    return fail(409, 'Part must be in Shipping before manual completion.');
  }

  const currentDepartment = await findDepartmentById(currentDepartmentId);
  const currentDepartmentName = currentDepartment?.name?.trim().toLowerCase() ?? '';
  if (currentDepartmentName !== 'shipping') {
    return fail(409, 'Part can only be manually completed from Shipping.');
  }

  const updated = await updateOrderPart(partId, { status: 'COMPLETE', currentDepartmentId });

  await recordPartEvent({
    orderId,
    partId,
    userId: userId ?? null,
    type: 'PART_COMPLETED',
    message: 'Part marked complete.',
  });

  await syncOrderWorkflowStatus(orderId, { userId: userId ?? null });
  return ok({ part: updated });
}

export async function listPartEvents({
  orderId,
  partId,
}: {
  orderId: string;
  partId: string;
}) {
  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found');

  const events = await listPartEventsForPart(orderId, partId);
  return ok({ events });
}

export async function getOrderHeaderInfo(orderId: string) {
  const order = await findOrderHeader(orderId);
  if (!order) return fail(404, 'Order not found');
  return ok({ order });
}

export async function getOrderPartSummary(orderId: string, partId: string) {
  const part = await findOrderPartSummary(orderId, partId);
  if (!part) return fail(404, 'Part not found');
  return ok({ part });
}

export async function logPartEvent(input: PartEventInput) {
  const event = await recordPartEvent(input);
  return ok({ event });
}

export async function listAddonsForOrders({
  q,
  cursor,
  take,
  active,
  includePricing,
}: {
  q?: string;
  cursor?: string;
  take: number;
  active?: boolean;
  includePricing?: boolean;
}) {
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
  };

  const items = await listAddons({
    where: Object.keys(where).length ? (where as any) : undefined,
    take,
    cursor,
  });
  const nextCursor = items.length > take ? items[take]?.id ?? null : null;
  if (nextCursor) items.pop();

  const sanitized = includePricing ? items : items.map(({ rateCents, ...rest }) => rest);
  return ok({ items: sanitized, nextCursor });
}

export async function getDepartmentsOrdered() {
  const items = await listDepartmentsOrdered();
  return ok({ items });
}

export async function getHomeDashboardData() {
  const overview = await getDashboardOrderOverview();
  return ok({
    ...overview,
    activeOrders: overview.activeOrders.map((order: any) => ({ ...order, status: normalizeOrderWorkflowStatus(order.status) })),
    recentOrders: overview.recentOrders.map((order: any) => ({ ...order, status: normalizeOrderWorkflowStatus(order.status) })),
  });
}

export async function searchOrders(query: string) {
  const normalized = query.trim();
  if (!normalized.length) return ok({ orders: [] });

  const variants = Array.from(
    new Set(
      normalized
        .split(/[\s-]+/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length >= 2)
    )
  );

  const orders = await searchOrdersByTerm(normalized, variants);
  return ok({ orders: orders.map((order: any) => ({ ...order, status: normalizeOrderWorkflowStatus(order.status) })) });
}


export async function getOrderDepartmentFeed(
  departmentId: string,
  includeCompleted = false,
): Promise<ServiceResult<{ items: DepartmentFeedOrder[] }>> {
  if (!departmentId) return fail(400, 'Department is required');
  const readyParts = await listReadyOrderPartsForDepartment(departmentId, includeCompleted);
  const readyPartIds = readyParts.map((part: any) => part.id).filter(Boolean);
  const partActivityById = readyPartIds.length
    ? buildPartActivityByPart(readyPartIds, await listTimeEntriesForPartsDetailed(readyPartIds))
    : {};
  const orders = new Map<string, DepartmentFeedOrder>();

  readyParts.forEach((part: any) => {
    const order = part.order;
    if (!order) return;
    const partActivity = partActivityById[part.id] ?? { activeTimers: [], timeByUser: [], totalSeconds: 0 };

    const parsedEvents = (part.partEvents ?? []).map((event: any) => {
      if (typeof event.meta === 'string') {
        try {
          return { ...event, meta: JSON.parse(event.meta) as Record<string, unknown> };
        } catch {
          return { ...event, meta: null };
        }
      }
      return { ...event, meta: (event.meta ?? null) as Record<string, unknown> | null };
    });
    const flaggedEvent = parsedEvents.find((event: any) => event.meta?.flag === true) ?? null;
    const checklistItems = Array.isArray(part.checklistItems) ? part.checklistItems : [];
    const checklistTotalCount = checklistItems.length;
    const checklistDoneCount = checklistItems.filter((item: any) => item.completed === true).length;

    const existing =
      orders.get(order.id) ??
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name ?? null,
        dueDate: order.dueDate ?? null,
        status: normalizeOrderWorkflowStatus(order.status),
        assignedMachinistName: order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? null,
        partsInDeptCount: 0,
        openChecklistCount: 0,
        flaggedCount: 0,
        latestActivityAt: null,
        activeTimerCount: 0,
        activeTimers: [],
        parts: [],
      };

    existing.parts.push({
      id: part.id,
      partNumber: part.partNumber ?? null,
      quantity: part.quantity ?? null,
      currentDepartmentId: part.currentDepartmentId ?? departmentId,
      currentDepartmentName: part.currentDepartment?.name ?? null,
      flagged: Boolean(flaggedEvent),
      reasonText: typeof flaggedEvent?.meta?.reasonText === 'string' ? String(flaggedEvent.meta.reasonText) : null,
      checklistDoneCount,
      checklistTotalCount,
      assignedWorkers: (Array.isArray(part.assignments) ? part.assignments : [])
        .filter((assignment: any) => assignment?.user?.active !== false)
        .map((assignment: any) => ({
          id: String(assignment.user.id),
          name: getUserLabel(assignment.user),
        })),
    });
    existing.partsInDeptCount += 1;
    existing.openChecklistCount += Math.max(checklistTotalCount - checklistDoneCount, 0);
    if (flaggedEvent) existing.flaggedCount += 1;
    const activeTimers = Array.isArray(partActivity.activeTimers) ? partActivity.activeTimers : [];
    activeTimers.forEach((timer: any) => {
      existing.activeTimers.push({
        id: String(timer?.id ?? `${part.id}-${timer?.userId ?? 'worker'}`),
        userId: typeof timer?.userId === 'string' ? timer.userId : null,
        userName: getUserLabel(timer?.user ?? null),
        elapsedSeconds: Number(timer?.elapsedSeconds ?? 0),
        departmentId: typeof timer?.departmentId === 'string' ? timer.departmentId : null,
        departmentName:
          typeof timer?.departmentName === 'string' && timer.departmentName.trim().length
            ? timer.departmentName
            : part.currentDepartment?.name ?? null,
        partId: part.id,
        partNumber: part.partNumber ?? null,
      });
      existing.activeTimerCount += 1;
    });

    const eventAt = flaggedEvent?.createdAt ? new Date(flaggedEvent.createdAt) : null;
    if (eventAt && !Number.isNaN(eventAt.getTime())) {
      const current = existing.latestActivityAt ? new Date(existing.latestActivityAt) : null;
      if (!current || Number.isNaN(current.getTime()) || eventAt.getTime() > current.getTime()) {
        existing.latestActivityAt = eventAt;
      }
    }

    orders.set(order.id, existing);
  });

  const items = Array.from(orders.values())
    .sort((a, b) => {
      if (a.activeTimerCount !== b.activeTimerCount) return b.activeTimerCount - a.activeTimerCount;
      if (a.flaggedCount !== b.flaggedCount) return b.flaggedCount - a.flaggedCount;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true, sensitivity: 'base' });
    })
    .map((order) => ({
      ...order,
      assignedMachinistName: order.assignedMachinistName ?? (
        Array.from(new Set(
          order.parts.flatMap((part) => part.assignedWorkers.map((worker) => worker.name)),
        )).join(', ') || null
      ),
      activeTimers: [...order.activeTimers]
        .sort((a, b) => {
          if (b.elapsedSeconds !== a.elapsedSeconds) return b.elapsedSeconds - a.elapsedSeconds;
          return a.userName.localeCompare(b.userName, undefined, { sensitivity: 'base' });
        })
        .slice(0, 6),
      parts: [...order.parts].sort((a, b) => {
        if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
        return (a.partNumber ?? '').localeCompare((b.partNumber ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      }),
    }));

  return ok({ items });
}

export async function transitionPartsDepartment({
  orderId,
  fromDepartmentId,
  toDepartmentId,
  partIds,
  employeeName,
  togglerId,
  reasonCode,
  reasonText,
}: {
  orderId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  partIds: string[];
  employeeName: string;
  togglerId?: string;
  reasonCode?: string;
  reasonText?: string;
}) {
  if (!orderId) return fail(400, 'Order is required');
  if (!fromDepartmentId) return fail(400, 'Missing fromDepartmentId');
  if (!toDepartmentId) return fail(400, 'Missing toDepartmentId');
  if (!Array.isArray(partIds) || partIds.length === 0) return fail(400, 'No parts selected');
  if (!employeeName) return fail(400, 'Employee name is required');

  const orderExists = await findOrderById(orderId);
  if (!orderExists) return fail(404, 'Order not found');

  const [targetDepartment, departments] = await Promise.all([
    findActiveDepartmentById(toDepartmentId),
    listDepartmentsOrdered(),
  ]);
  if (!targetDepartment) return fail(400, 'Target department not found');

  const parts = await listOrderPartsByIds(orderId, partIds);
  if (parts.length !== partIds.length) return fail(404, 'Part not found in order');

  const invalidPart = parts.find((part) => part.currentDepartmentId !== fromDepartmentId);
  if (invalidPart) return fail(400, 'Part is not in the expected department');

  const isBackward = isBackwardsMove(fromDepartmentId, toDepartmentId, departments);
  if (!reasonText?.trim()) {
    return fail(400, 'A note is required for manual department transitions.');
  }

  const fromDepartment = await findDepartmentById(fromDepartmentId);
  const fromLabel = fromDepartment?.name ?? fromDepartmentId;
  const toLabel = targetDepartment.name ?? toDepartmentId;

  await moveOrderPartsToDepartment({
    orderId,
    partIds,
    toDepartmentId,
    statusHistory: {
      from: `Department ${fromLabel}`,
      to: `Department ${toLabel}`,
      userId: togglerId ?? null,
      reason: `Moved ${partIds.length} part${partIds.length === 1 ? '' : 's'} from ${fromLabel} to ${toLabel} by ${employeeName}`,
    },
  });

  await Promise.all(partIds.map((partId) =>
    recordPartEvent({
      orderId,
      partId,
      userId: togglerId ?? null,
      type: 'DEPARTMENT_SET_MANUAL',
      message: `Department manually moved from ${fromLabel} to ${toLabel}.`,
      meta: {
        fromDepartmentId,
        toDepartmentId,
        reasonCode: reasonCode ?? null,
        reasonText: reasonText?.trim() || null,
        flag: isBackward,
        transitionType: 'manual',
      },
    }),
  ));

  await syncOrderWorkflowStatus(orderId, { userId: togglerId ?? null });
  return ok({ ok: true });
}

export async function getOrderPrintData(orderId: string) {
  const order = await findOrderWithDetails(orderId);
  if (!order) return fail(404, 'Not found');

  const addons = await listAddons({ where: { active: true }, take: 200 });
  return ok({ order, addons });
}
