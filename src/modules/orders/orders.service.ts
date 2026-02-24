import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { BusinessCode } from '@/lib/businesses';
import { BUSINESS_PREFIX_BY_CODE } from '@/lib/businesses';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import {
  OrderAttachmentCreate,
  OrderChargeCreate,
  OrderChargeUpdate,
  OrderCreate,
  OrderPartCreate,
  OrderPartUpdate,
  OrderUpdate,
  PartAttachmentCreate,
  PartAttachmentUpdate,
} from './orders.schema';
import type { OrderFilterState, OrderListItem, OrderWithMeta } from './orders.types';
import { isPartReadyForDepartment } from './department-routing';
import {
  createOrderAttachment,
  createOrderCharge,
  createOrderNote,
  createOrderPartWithCharges,
  createOrderWithCustomFields,
  createPartEvent,
  countIncompleteActiveChecklistItemsForPart,
  countOrderParts,
  createPartAttachment,
  createStatusHistoryEntry,
  deleteOrderChargeWithChecklist,
  deleteOrderPartWithRelations,
  deletePartAttachment,
  findActiveOrderCustomFields,
  findAddonById,
  findAddonDepartment,
  findChargeById,
  findChecklistByAddon,
  findChecklistByCharge,
  findChecklistById,
  findActiveDepartmentById,
  findDepartmentById,
  findOrderById,
  findOrderHeader,
  findOrderCharge,
  findOrderPart,
  findOrderPartSummary,
  findOrderPartWithCharges,
  findChecklistByOrderPartDepartment,
  findOrderStatus,
  findOrderSummary,
  findOrderWithDetails,
  findPartAttachment,
  findPartById,
  findPartForRouting,
  findChecklistForRoutingById,
  findPartWithOrderInfo,
  findUserById,
  listPartEventsForPart,
  listAddons,
  listAddonsByIds,
  listChecklistItems,
  runInTransaction,
  setChecklistCompletion,
  updatePartCurrentDepartment,
  listDepartmentsOrdered,
  listOrderLevelDepartmentChecklistItems,
  listOrderCharges,
  listOrderPartsMissingCurrentDepartment,
  listOrders,
  listOrderPartsByIds,
  listReadyOrderPartsForDepartment,
  listPartAttachments,
  getDashboardOrderOverview,
  searchOrdersByTerm,
  moveOrderPartsToDepartment,
  createOrderChecklistItem,
  updateChecklistCompletion,
  updateOrderChecklistItem,
  deleteOrderChecklistItem,
  updateOrder,
  updateOrderAssignee,
  updateOrderCharge,
  updateOrderPart,
  updatePartAttachment,
  updateOrderStatus,
  generateNextOrderNumber,
  syncChecklistForOrder,
} from '@/repos/orders';

export { generateNextOrderNumber, syncChecklistForOrder };
export type { OrderFilterState, OrderListItem, OrderWithMeta };
export { isPartReadyForDepartment };

export type DepartmentFeedPart = { id: string; partNumber: string | null; quantity: number | null; flagged: boolean; reasonText: string | null; hasOpenWork: boolean };
export type DepartmentFeedOrder = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  dueDate: Date | string | null;
  status: string;
  totalParts: number;
  readyParts: DepartmentFeedPart[];
  readyPartsCount: number;
};

type OrderCreateInput = z.infer<typeof OrderCreate>;
type OrderUpdateInput = z.infer<typeof OrderUpdate>;
type OrderChargeCreateInput = z.infer<typeof OrderChargeCreate>;
type OrderChargeUpdateInput = z.infer<typeof OrderChargeUpdate>;
type OrderPartCreateInput = z.infer<typeof OrderPartCreate>;
type OrderPartUpdateInput = z.infer<typeof OrderPartUpdate>;
type OrderAttachmentCreateInput = z.infer<typeof OrderAttachmentCreate>;
type PartAttachmentCreateInput = z.infer<typeof PartAttachmentCreate>;
type PartAttachmentUpdateInput = z.infer<typeof PartAttachmentUpdate>;
type PartEventInput = {
  db?: any;
  orderId: string;
  partId: string;
  userId?: string | null;
  type: string;
  message: string;
  meta?: Record<string, unknown> | null;
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  RECEIVED: 'Received',
  PROGRAMMING: 'Programming',
  RUNNING: 'Running',
  INSPECTING: 'Inspecting',
  READY_FOR_ADDONS: 'Ready for addons',
  COMPLETE: 'Complete',
  CLOSED: 'Closed',
  SETUP: 'Setup',
  FINISHING: 'Finishing',
  DONE_MACHINING: 'Machining Done',
  INSPECTION: 'Inspection',
  SHIPPING: 'Shipping',
};

export const STALE_STATUS_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  statuses: [],
  priorities: [],
  machinistId: 'all',
  requiresAddons: false,
  staleStatus: false,
};

async function recordPartEvent({ orderId, partId, userId, type, message, meta, db }: PartEventInput) {
  return createPartEvent({
    orderId,
    partId,
    userId: userId ?? null,
    type,
    message,
    meta: meta ?? null,
  }, db);
}

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

export function decorateOrder(order: OrderListItem): OrderWithMeta {
  const totalQuantity = (order.parts ?? []).reduce((sum, part) => sum + (part.quantity ?? 0), 0);
  const addonCount = order.checklist?.length ?? 0;
  const openAddonCount = order.checklist?.filter((item) => !item.completed).length ?? 0;
  const latestStatusHistory = order.statusHistory?.[0];
  const lastStatusChange = latestStatusHistory ? parseDate(latestStatusHistory.createdAt) : parseDate(order.receivedDate);

  return {
    ...order,
    totalQuantity,
    addonCount,
    openAddonCount,
    hasAddons: addonCount > 0,
    lastStatusChange,
  };
}

export function formatStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function orderMatchesFilters(
  order: OrderWithMeta,
  filters: OrderFilterState,
  quickStatus: 'all' | 'active' | 'closed',
  priorityFilter: string,
) {
  if (quickStatus === 'active' && order.status === 'CLOSED') return false;
  if (quickStatus === 'closed' && order.status !== 'CLOSED') return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(order.status)) return false;

  if (priorityFilter !== 'all' && order.priority !== priorityFilter) return false;
  if (filters.priorities.length > 0 && !filters.priorities.includes(order.priority)) return false;

  if (filters.machinistId !== 'all') {
    if (filters.machinistId === '__unassigned__' && order.assignedMachinist?.id) return false;
    if (filters.machinistId !== '__unassigned__' && order.assignedMachinist?.id !== filters.machinistId) return false;
  }

  const created = parseDate(order.receivedDate);
  if (filters.createdFrom) {
    const fromDate = new Date(filters.createdFrom);
    if (created && created < fromDate) return false;
  }
  if (filters.createdTo) {
    const toDate = new Date(filters.createdTo);
    if (created && created > toDate) return false;
  }

  const due = parseDate(order.dueDate);
  if (filters.dueFrom) {
    const fromDate = new Date(filters.dueFrom);
    if (due && due < fromDate) return false;
  }
  if (filters.dueTo) {
    const toDate = new Date(filters.dueTo);
    if (due && due > toDate) return false;
  }

  if (typeof filters.minQty === 'number' && order.totalQuantity < filters.minQty) return false;
  if (typeof filters.maxQty === 'number' && order.totalQuantity > filters.maxQty) return false;

  if (filters.requiresAddons && !order.hasAddons) return false;

  if (filters.staleStatus) {
    const lastChange = order.lastStatusChange?.getTime();
    if (!lastChange) return false;
    if (Date.now() - lastChange < STALE_STATUS_MS) return false;
  }

  return true;
}

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

function toDecimal(value: string) {
  return new Prisma.Decimal(value);
}

function serializeCharge(charge: any) {
  const quantity = charge.quantity instanceof Prisma.Decimal ? charge.quantity : new Prisma.Decimal(charge.quantity);
  const unitPrice = charge.unitPrice instanceof Prisma.Decimal ? charge.unitPrice : new Prisma.Decimal(charge.unitPrice);
  return {
    ...charge,
    quantity: quantity.toString(),
    unitPrice: unitPrice.toString(),
    totalPrice: unitPrice.mul(quantity).toString(),
  };
}

export async function listOrdersForQuery(params: {
  q?: string;
  status?: string;
  priority?: string;
  assignedMachinistId?: string;
  customerId?: string;
  overdue?: boolean;
  awaitingMaterial?: boolean;
  take: number;
  cursor?: string | null;
}) {
  const { q, status, priority, assignedMachinistId, customerId, overdue, awaitingMaterial, take, cursor } = params;
  const where: Record<string, any> = {};
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedMachinistId) where.assignedMachinistId = assignedMachinistId;
  if (customerId) where.customerId = customerId;
  if (overdue) where.dueDate = { lt: new Date() };
  if (awaitingMaterial) where.AND = [...(where.AND ?? []), { materialNeeded: true, materialOrdered: false }];

  const items = await listOrders({ where, take, cursor });
  const nextCursor = items.length === take ? items[items.length - 1].id : null;
  return ok({ items, nextCursor });
}

export async function createOrderFromPayload(body: OrderCreateInput, userId?: string) {
  const prefix = BUSINESS_PREFIX_BY_CODE[body.business as keyof typeof BUSINESS_PREFIX_BY_CODE] ?? body.business;
  const providedOrderNumber = body.orderNumber?.trim();
  let orderNumber: string;
  if (providedOrderNumber && providedOrderNumber.length > 0) {
    if (!providedOrderNumber.startsWith(`${prefix}-`)) {
      return fail(400, `Order numbers for ${prefix} must start with ${prefix}-`);
    }
    orderNumber = providedOrderNumber;
  } else {
    orderNumber = await generateNextOrderNumber(body.business as BusinessCode);
  }

  const customFieldValues = body.customFieldValues ?? [];
  const validCustomFieldValues = customFieldValues.length
    ? await findActiveOrderCustomFields({
        fieldIds: customFieldValues.map((value) => value.fieldId),
        business: body.business as BusinessCode,
      })
    : [];
  const allowedFieldIds = new Set(validCustomFieldValues.map((field) => field.id));
  const normalizedCustomFieldValues = customFieldValues
    .filter((value) => allowedFieldIds.has(value.fieldId) && hasCustomFieldValue(value.value))
    .map((value) => ({
      fieldId: value.fieldId,
      value: serializeCustomFieldValue(value.value),
    }))
    .filter((value) => value.value !== null) as { fieldId: string; value: string }[];

  type AddonRecord = {
    id: string;
    name: string;
    rateCents: number;
    rateType: string;
    departmentId: string;
    affectsPrice: boolean;
    isChecklistItem: boolean;
  };

  const created = await createOrderWithCustomFields({
    orderData: {
      data: {
        orderNumber,
        business: body.business,
        customerId: body.customerId,
        modelIncluded: body.modelIncluded,
        receivedDate: new Date(body.receivedDate),
        dueDate: new Date(body.dueDate),
        priority: body.priority,
        status: 'RECEIVED',
        materialNeeded: body.materialNeeded,
        materialOrdered: body.materialOrdered,
        vendorId: body.vendorId ?? null,
        poNumber: body.poNumber ?? null,
        assignedMachinistId: body.assignedMachinistId ?? null,
        parts: {
          create: body.parts.map((p) => ({
            partNumber: p.partNumber,
            quantity: p.quantity,
            materialId: p.materialId ?? null,
            stockSize: p.stockSize ?? null,
            cutLength: p.cutLength ?? null,
            notes: p.notes ?? null,
          })),
        },
        attachments: body.attachments.length
          ? {
              create: body.attachments.map((a) => ({
                url: a.url ?? null,
                storagePath: a.storagePath ?? null,
                label: a.label ?? null,
                mimeType: a.mimeType ?? null,
                uploadedById: userId ?? null,
              })),
            }
          : undefined,
        notes:
          body.notes && userId
            ? {
                create: {
                  content: body.notes,
                  userId,
                },
              }
            : undefined,
        statusHistory: {
          create: {
            from: 'RECEIVED',
            to: 'RECEIVED',
            userId,
            reason: 'Order created',
          },
        },
      },
      select: { id: true, parts: { select: { id: true }, orderBy: { createdAt: 'asc' } } },
    },
    customFieldValues: normalizedCustomFieldValues,
  });

  const selectionsByPart = body.parts
    .map((part, index) => ({
      partId: created.parts?.[index]?.id ?? null,
      selections: part.addonSelections ?? [],
    }))
    .filter((entry) => entry.partId && entry.selections.length);

  const checklistKeys = new Set<string>();

  if (selectionsByPart.length) {
    const addonIds = Array.from(
      new Set(
        selectionsByPart.flatMap((entry) => entry.selections.map((selection) => selection.addonId))
      )
    );
    const addons = (await listAddonsByIds(addonIds)) as AddonRecord[];
    const addonMap = new Map(addons.map((addon) => [addon.id, addon]));

    let sortOrder = 0;
    for (const entry of selectionsByPart) {
      for (const selection of entry.selections) {
        const addon = addonMap.get(selection.addonId);
        if (!addon || !entry.partId) continue;
        if (addon.affectsPrice) {
          await createOrderCharge({
            data: {
              orderId: created.id,
              partId: entry.partId,
              departmentId: addon.departmentId,
              addonId: addon.id,
              kind: 'ADDON',
              name: addon.name,
              description: selection.notes ?? null,
              quantity: new Prisma.Decimal(selection.units ?? 0),
              unitPrice: new Prisma.Decimal(addon.rateCents ?? 0),
              sortOrder: sortOrder++,
            },
          });
        }

        if (addon.isChecklistItem && !addon.affectsPrice) {
          const checklistKey = `${entry.partId}:${addon.id}`;
          if (checklistKeys.has(checklistKey)) continue;
          checklistKeys.add(checklistKey);
          await createOrderChecklistItem({
            orderId: created.id,
            partId: entry.partId,
            addonId: addon.id,
            departmentId: addon.departmentId ?? null,
            completed: false,
            isActive: true,
          });
        }
      }
    }

    await syncChecklistForOrder(created.id);
  }

  if (body.addonIds.length) {
    const addons = (await listAddonsByIds(body.addonIds)) as AddonRecord[];
    const checklistAddons = addons.filter((addon) => addon.isChecklistItem && !addon.affectsPrice);
    if (checklistAddons.length && created.parts?.length) {
      for (const part of created.parts) {
        for (const addon of checklistAddons) {
          const checklistKey = `${part.id}:${addon.id}`;
          if (checklistKeys.has(checklistKey)) continue;
          checklistKeys.add(checklistKey);
          await createOrderChecklistItem({
            orderId: created.id,
            partId: part.id,
            addonId: addon.id,
            departmentId: addon.departmentId ?? null,
            completed: false,
            isActive: true,
          });
        }
      }
    }
  }

  return ok({ id: created.id });
}

export async function getOrderDetails(id: string, isAdmin: boolean) {
  const order = await findOrderWithDetails(id);
  if (!order) return fail(404, 'Not found');
  return ok({
    item: sanitizePricingForNonAdmin(order, isAdmin),
    permissions: { canEditParts: isAdmin },
  });
}

export async function updateOrderDetails(id: string, payload: OrderUpdateInput) {
  const data: Record<string, unknown> = {};

  if (payload.business !== undefined) data.business = payload.business;

  if (payload.customerId !== undefined) data.customerId = payload.customerId;

  if (payload.receivedDate !== undefined) {
    const date = new Date(payload.receivedDate);
    if (Number.isNaN(date.getTime())) {
      return fail(400, 'Invalid received date');
    }
    data.receivedDate = date;
  }

  if (payload.dueDate !== undefined) {
    const date = new Date(payload.dueDate);
    if (Number.isNaN(date.getTime())) {
      return fail(400, 'Invalid due date');
    }
    data.dueDate = date;
  }

  if (payload.priority !== undefined) data.priority = payload.priority;
  if (payload.vendorId !== undefined) data.vendorId = payload.vendorId || null;
  if (payload.poNumber !== undefined) data.poNumber = payload.poNumber || null;
  if (payload.materialNeeded !== undefined) data.materialNeeded = payload.materialNeeded;
  if (payload.materialOrdered !== undefined) data.materialOrdered = payload.materialOrdered;
  if (payload.modelIncluded !== undefined) data.modelIncluded = payload.modelIncluded;
  if (payload.assignedMachinistId !== undefined)
    data.assignedMachinistId = payload.assignedMachinistId || null;

  if (Object.keys(data).length === 0) {
    return fail(400, 'No fields to update');
  }

  await updateOrder(id, data);
  return ok({ ok: true });
}

export async function updateOrderStatusForEmployee({
  orderId,
  status,
  employeeName,
  userId,
}: {
  orderId: string;
  status: string;
  employeeName: string;
  userId?: string;
}) {
  const allowed = ['NEW', 'PROGRAMMING', 'RUNNING', 'INSPECTING', 'READY_FOR_ADDONS', 'COMPLETE', 'CLOSED'];
  if (!status || !allowed.includes(status)) return fail(400, 'Invalid status');
  if (!employeeName) return fail(400, 'Employee name is required');

  const existingOrder = await findOrderStatus(orderId);
  if (!existingOrder) return fail(404, 'Order not found');

  const updatedOrder = await updateOrderStatus(orderId, status);
  await createStatusHistoryEntry({
    orderId,
    from: existingOrder.status,
    to: status,
    userId,
    reason: `Status changed by ${employeeName}`,
  });
  return ok({ order: updatedOrder });
}

export async function assignMachinistToOrder(orderId: string, machinistId: string | null) {
  const order = await updateOrderAssignee(orderId, machinistId);
  return ok({ item: order });
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

  if (fromDepartmentId === toDepartmentId) {
    return ok({ partId, orderId: part.orderId, currentDepartmentId: fromDepartmentId, changed: false, flagged: false });
  }

  const backwards = isBackwardsMove(fromDepartmentId, toDepartmentId, departments);
  const manual = transitionType === 'manual';
  if ((manual || backwards) && !reasonCode && !reasonText?.trim()) {
    return fail(400, 'Reason is required for rework/backward/manual department transitions.');
  }

  await updatePartCurrentDepartment(partId, toDepartmentId, tx);

  let type = 'DEPARTMENT_ADVANCED';
  if (manual) type = 'DEPARTMENT_SET_MANUAL';
  else if (backwards) type = 'DEPARTMENT_REWORKED';

  const fromLabel = getDepartmentName(departments, fromDepartmentId);
  const toLabel = getDepartmentName(departments, toDepartmentId);
  const flagged = backwards || (manual && backwards);

  await recordPartEvent({
    db: tx,
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
  });

  return ok({ partId, orderId: part.orderId, currentDepartmentId: toDepartmentId, changed: true, flagged });
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

export async function completeChecklistAndAdvance({ orderId, partId, checklistId, actorUserId }: { orderId: string; partId: string; checklistId: string; actorUserId?: string }) {
  const result = await runInTransaction(async (tx) => {
    const checklist = await findChecklistForRoutingById(checklistId, tx);
    if (!checklist || checklist.orderId !== orderId || checklist.partId !== partId) {
      throw new Error('CHECKLIST_NOT_FOUND');
    }

    await setChecklistCompletion({ checklistId, checked: true, toggledById: actorUserId ?? null, chargeId: checklist.chargeId }, tx);
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
  return ok({ part: { id: partId, currentDepartmentId: result.currentDepartmentId, flagged: result.flagged } });
}

export async function toggleChecklistItem({
  orderId,
  checklistId,
  chargeId,
  addonId,
  partId,
  checked,
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
  const toggler = togglerId ? await findUserById(togglerId) : null;
  const toggledById = toggler ? toggler.id : null;

  const departments = await listDepartmentsOrdered();
  const partSnapshot = existingChecklist.partId ? await findPartForRouting(existingChecklist.partId) : null;
  const fromDepartmentId = partSnapshot?.currentDepartmentId ?? null;
  const simulatedItems = (partSnapshot?.checklistItems ?? []).map((item) =>
    item.id === existingChecklist.id ? { ...item, completed: checked } : item,
  );
  const simulatedDepartmentId = partSnapshot ? selectDepartmentForPart(simulatedItems, departments) : null;
  const causesBackwards = Boolean(partSnapshot) && isBackwardsMove(fromDepartmentId, simulatedDepartmentId, departments);
  if (!checked && causesBackwards && !reasonCode && !reasonText?.trim()) {
    return fail(400, 'Reason is required when reopening work moves a part backward.');
  }

  await setChecklistCompletion({
    checklistId: existingChecklist.id,
    checked,
    toggledById,
    chargeId: existingChecklist.chargeId,
  });

  const label = charge?.name ?? addonExists?.name ?? 'Checklist';
  const togglerLabel = employeeName?.trim() || toggledById || 'Unknown user';

  await createStatusHistoryEntry({
    orderId,
    from: `${label} ${previousState ? 'checked' : 'unchecked'}`,
    to: `${label} ${checked ? 'checked' : 'unchecked'}`,
    userId: toggledById ?? undefined,
    reason: `Checklist "${label}" ${checked ? 'checked' : 'unchecked'} by ${togglerLabel}`,
  });

  if (existingChecklist.partId) {
    await recordPartEvent({
      orderId,
      partId: existingChecklist.partId,
      userId: toggledById ?? undefined,
      type: 'CHECKLIST_TOGGLED',
      message: `${label} ${checked ? 'checked' : 'unchecked'}.`,
      meta: { checklistId: existingChecklist.id, checked },
    });

    const recompute = await recomputePartDepartment(existingChecklist.partId, {
      actorUserId: toggledById ?? undefined,
      reasonCode: !checked && causesBackwards ? reasonCode : undefined,
      reasonText: !checked && causesBackwards ? reasonText : undefined,
    });
    if (recompute.ok === false) return recompute;
  }

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
    const targetDepartmentId = selectDepartmentForPart(part.checklistItems ?? [], departments);
    if (!targetDepartmentId) continue;
    await updateOrderPart(part.id, { currentDepartmentId: targetDepartmentId });
    updatedCount += 1;
  }

  return { updatedCount };
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
  if (!reasonCode && !reasonText?.trim()) return fail(400, 'Reason is required for manual department transitions.');

  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const part = await findOrderPart(orderId, partId);
  if (!part) return fail(404, 'Part not found for this order');

  const [department, departments] = await Promise.all([findActiveDepartmentById(departmentId), listDepartmentsOrdered()]);
  if (!department) return fail(400, 'Department not found');

  const fromDepartmentId = part.currentDepartmentId ?? null;
  const isBackward = isBackwardsMove(fromDepartmentId, departmentId, departments);

  await updateOrderPart(part.id, { currentDepartmentId: departmentId });
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
  return ok({ ok: true });
}

export async function addOrderPart({
  orderId,
  payload,
  invoiceAction,
  copyChargesFromPartId,
  userId,
}: {
  orderId: string;
  payload: OrderPartCreateInput;
  invoiceAction?: 'new' | 'update';
  copyChargesFromPartId?: string;
  userId?: string;
}) {
  const order = await findOrderSummary(orderId);
  if (!order) {
    return fail(404, 'Order not found');
  }

  let sourcePart: { id: string; partNumber: string | null } | null = null;
  if (copyChargesFromPartId) {
    sourcePart = await findOrderPartSummary(orderId, copyChargesFromPartId);
    if (!sourcePart) {
      return fail(404, 'Source part not found on this order');
    }
  }

  const noteBuilder = userId
    ? ({ part, copiedCharges }: { part: { partNumber: string; quantity: number }; copiedCharges: number }) => {
        const invoiceLine =
          invoiceAction === 'update'
            ? `Invoice action: update existing invoice (invalidates prior PO${order.poNumber ? ` ${order.poNumber}` : ''}). Previous invoice/PO remain in attachments and notes.`
            : invoiceAction === 'new'
              ? 'Invoice action: create a separate invoice for the added part.'
              : null;
        const copyLine = sourcePart
          ? `Add-ons/labor: copied ${copiedCharges} charge${copiedCharges === 1 ? '' : 's'} from ${
              sourcePart.partNumber ?? 'selected part'
            }.`
          : null;
        const noteLines = [
          `Added part ${part.partNumber} (qty ${part.quantity}).`,
          copyLine,
          invoiceLine,
        ].filter(Boolean);
        return noteLines.join(' ');
      }
    : undefined;

  const result = await createOrderPartWithCharges({
    orderId,
    partData: {
      partNumber: payload.partNumber,
      quantity: payload.quantity,
      materialId: payload.materialId ?? null,
      stockSize: payload.stockSize ?? null,
      cutLength: payload.cutLength ?? null,
      notes: payload.notes ?? null,
    },
    sourcePartId: sourcePart?.id ?? null,
    userId: userId ?? null,
    noteBuilder,
  });

  if (sourcePart) {
    await syncChecklistForOrder(orderId);
    await initializeCurrentDepartmentForParts({ orderId });
  }

  return ok({ part: result.part, copiedCharges: result.copiedCharges });
}

export async function updateOrderPartDetails({
  orderId,
  partId,
  payload,
  userId,
}: {
  orderId: string;
  partId: string;
  payload: OrderPartUpdateInput;
  userId?: string;
}) {
  const existing = await findOrderPart(orderId, partId);
  if (!existing) {
    return fail(404, 'Part not found for this order');
  }

  const data: Record<string, unknown> = {};
  if (payload.partNumber !== undefined) data.partNumber = payload.partNumber;
  if (payload.quantity !== undefined) data.quantity = payload.quantity;
  if (payload.materialId !== undefined) data.materialId = payload.materialId;
  if (payload.stockSize !== undefined) data.stockSize = payload.stockSize;
  if (payload.cutLength !== undefined) data.cutLength = payload.cutLength;
  if (payload.notes !== undefined) data.notes = payload.notes;

  const part = await updateOrderPart(partId, data);

  if (userId) {
    await createOrderNote(orderId, userId, `Updated part ${part.partNumber}.`);
    await recordPartEvent({
      orderId,
      partId: part.id,
      userId,
      type: 'PART_UPDATED',
      message: `Updated ${part.partNumber}.`,
    });
  }

  return ok({ part });
}

export async function deleteOrderPartDetails({
  orderId,
  partId,
  userId,
}: {
  orderId: string;
  partId: string;
  userId?: string;
}) {
  const partCount = await countOrderParts(orderId);
  if (partCount <= 1) {
    return fail(400, 'Orders must contain at least one part.');
  }

  const part = await findOrderPartWithCharges(orderId, partId);
  if (!part) {
    return fail(404, 'Part not found for this order');
  }

  const chargeIds = part.charges.map((charge) => charge.id);
  await deleteOrderPartWithRelations({
    orderId,
    partId,
    chargeIds,
    noteContent: userId ? `Removed part ${part.partNumber} (qty ${part.quantity}).` : null,
    userId: userId ?? null,
  });

  await syncChecklistForOrder(orderId);
  return ok({ ok: true });
}

export async function listChargesForOrder(orderId: string) {
  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const charges = await listOrderCharges(orderId);
  return ok({ charges: charges.map(serializeCharge) });
}

export async function createChargeForOrder({
  orderId,
  payload,
}: {
  orderId: string;
  payload: OrderChargeCreateInput;
}) {
  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const part = await findOrderPartSummary(orderId, payload.partId);
  if (!part) return fail(404, 'Part not found on order');

  const department = await findDepartmentById(payload.departmentId);
  if (!department) return fail(404, 'Department not found');

  if (payload.addonId) {
    const addon = await findAddonDepartment(payload.addonId);
    if (!addon) return fail(404, 'Addon not found');
    if (addon.departmentId !== payload.departmentId) {
      return fail(400, 'Addon does not belong to department');
    }
  }

  const charge = await createOrderCharge({
    data: {
      orderId,
      partId: payload.partId,
      departmentId: payload.departmentId,
      addonId: payload.addonId ?? null,
      kind: payload.kind,
      name: payload.name,
      description: payload.description ?? null,
      quantity: toDecimal(payload.quantity),
      unitPrice: toDecimal(payload.unitPrice),
      sortOrder: payload.sortOrder ?? 0,
    },
    include: { department: true, part: true },
  });

  await syncChecklistForOrder(orderId);
  await initializeCurrentDepartmentForParts({ orderId });
  return ok({ charge: serializeCharge(charge) });
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
  const charge = await findOrderCharge(orderId, chargeId);
  if (!charge) return fail(404, 'Charge not found');

  if (payload.partId === null) {
    return fail(400, 'partId cannot be null for order charges.');
  }

  const nextPartId = payload.partId !== undefined ? payload.partId : charge.partId;

  if (!nextPartId) {
    return fail(400, 'partId is required for all charge kinds (orders are containers; parts are work units).');
  }

  const part = await findOrderPartSummary(orderId, payload.partId);
  if (!part) return fail(404, 'Part not found on order');

  if (payload.departmentId) {
    const department = await findDepartmentById(payload.departmentId);
    if (!department) return fail(404, 'Department not found');
  }

  if (payload.addonId !== undefined && payload.addonId !== null) {
    const addon = await findAddonDepartment(payload.addonId);
    if (!addon) return fail(404, 'Addon not found');
    if (payload.departmentId && addon.departmentId !== payload.departmentId) {
      return fail(400, 'Addon does not belong to department');
    }
  }

  const data: Record<string, any> = {};
  if (payload.partId !== undefined) data.partId = payload.partId;
  if (payload.departmentId !== undefined) data.departmentId = payload.departmentId;
  if (payload.addonId !== undefined) data.addonId = payload.addonId ?? null;
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description ?? null;
  if (payload.quantity !== undefined) data.quantity = toDecimal(payload.quantity);
  if (payload.unitPrice !== undefined) data.unitPrice = toDecimal(payload.unitPrice);
  if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
  if (payload.completed !== undefined) data.completedAt = payload.completed ? new Date() : null;

  const updated = await updateOrderCharge(chargeId, data);
  await syncChecklistForOrder(orderId);
  await initializeCurrentDepartmentForParts({ orderId });
  return ok({ charge: serializeCharge(updated) });
}

export async function deleteChargeForOrder({ orderId, chargeId }: { orderId: string; chargeId: string }) {
  const charge = await findOrderCharge(orderId, chargeId);
  if (!charge) return fail(404, 'Charge not found');

  await deleteOrderChargeWithChecklist(chargeId);
  await syncChecklistForOrder(orderId);
  return ok({ ok: true });
}

export async function createAttachmentForOrder({
  orderId,
  payload,
  userId,
}: {
  orderId: string;
  payload: OrderAttachmentCreateInput;
  userId?: string;
}) {
  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const attachment = await createOrderAttachment({
    data: {
      orderId,
      url: payload.url ?? null,
      storagePath: payload.storagePath ?? null,
      label: payload.label?.length ? payload.label : null,
      mimeType: payload.mimeType?.length ? payload.mimeType : null,
      uploadedById: userId ?? null,
    },
  });

  return ok({ attachment });
}

export async function listAttachmentsForPart(partId: string) {
  const part = await findPartById(partId);
  if (!part) return fail(404, 'Part not found');

  const attachments = await listPartAttachments(partId);
  return ok({ attachments });
}

export async function createAttachmentForPart({
  partId,
  payload,
  userId,
}: {
  partId: string;
  payload: PartAttachmentCreateInput;
  userId?: string;
}) {
  const part = await findPartWithOrderInfo(partId);
  if (!part) return fail(404, 'Part not found');

  const attachment = await createPartAttachment({
    data: {
      orderId: part.orderId,
      partId,
      kind: payload.kind,
      url: payload.url ?? null,
      storagePath: payload.storagePath ?? null,
      label: payload.label ?? null,
      mimeType: payload.mimeType ?? null,
    },
  });

  if (userId) {
    const label = attachment.label || attachment.storagePath || attachment.url || 'File';
    await recordPartEvent({
      orderId: part.orderId,
      partId,
      userId,
      type: 'FILE_UPLOADED',
      message: `File uploaded: ${label}.`,
      meta: { attachmentId: attachment.id, kind: attachment.kind },
    });
  }

  return ok({ attachment });
}

export async function getPartUploadContext(partId: string) {
  const part = await findPartWithOrderInfo(partId);
  if (!part) return fail(404, 'Part not found');
  return ok({ part });
}

export async function updateAttachmentForPart({
  partId,
  attachmentId,
  payload,
}: {
  partId: string;
  attachmentId: string;
  payload: PartAttachmentUpdateInput;
}) {
  const attachment = await findPartAttachment(partId, attachmentId);
  if (!attachment) return fail(404, 'Attachment not found');

  const data: Record<string, any> = {};
  if (payload.kind !== undefined) data.kind = payload.kind;
  if (payload.url !== undefined) data.url = payload.url ?? null;
  if (payload.storagePath !== undefined) data.storagePath = payload.storagePath ?? null;
  if (payload.label !== undefined) data.label = payload.label ?? null;
  if (payload.mimeType !== undefined) data.mimeType = payload.mimeType ?? null;

  const updated = await updatePartAttachment(attachmentId, data);
  return ok({ attachment: updated });
}

export async function deleteAttachmentForPart(partId: string, attachmentId: string) {
  const attachment = await findPartAttachment(partId, attachmentId);
  if (!attachment) return fail(404, 'Attachment not found');

  await deletePartAttachment(attachmentId);
  return ok({ ok: true });
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
  const result = await runInTransaction(async (tx) => {
    const part = await findOrderPart(orderId, partId, tx);
    if (!part) return { error: 'PART_NOT_FOUND' } as const;

    const remainingChecklist = await countIncompleteActiveChecklistItemsForPart(orderId, partId, tx);
    if (remainingChecklist > 0) return { error: 'CHECKLIST_REMAINING' } as const;

    const updated = await updateOrderPart(partId, { status: 'COMPLETE' }, tx);

    await recordPartEvent({
      db: tx,
      orderId,
      partId,
      userId: userId ?? null,
      type: 'PART_COMPLETED',
      message: 'Part marked complete.',
    });

    return { part: updated } as const;
  });

  if ('error' in result) {
    if (result.error === 'PART_NOT_FOUND') return fail(404, 'Part not found');
    if (result.error === 'CHECKLIST_REMAINING') return fail(409, 'Cannot complete part: checklist items remain.');
  }

  return ok({ part: result.part });
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
}: {
  q?: string;
  cursor?: string;
  take: number;
  active?: boolean;
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

  const sanitized = items.map(({ rateCents, ...rest }) => rest);
  return ok({ items: sanitized, nextCursor });
}

export async function getDepartmentsOrdered() {
  const items = await listDepartmentsOrdered();
  return ok({ items });
}

export async function getHomeDashboardData() {
  const overview = await getDashboardOrderOverview();
  return ok(overview);
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
  return ok({ orders });
}

export async function getOrderDepartmentFeed(
  departmentId: string,
  includeCompleted = false,
): Promise<ServiceResult<{ items: DepartmentFeedOrder[] }>> {
  if (!departmentId) return fail(400, 'Department is required');
  const readyParts = await listReadyOrderPartsForDepartment(departmentId, includeCompleted);
  const orders = new Map<string, DepartmentFeedOrder>();

  readyParts.forEach((part) => {
    const order = part.order;
    if (!order) return;
    const existing =
      orders.get(order.id) ??
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name ?? null,
        dueDate: order.dueDate ?? null,
        status: order.status,
        totalParts: order.parts?.length ?? 0,
        readyParts: [],
        readyPartsCount: 0,
      };
    const latestMeta = (part.partEvents?.[0] as any)?.meta as Record<string, unknown> | null | undefined;
    existing.readyParts.push({
      id: part.id,
      partNumber: part.partNumber ?? null,
      quantity: part.quantity ?? null,
      flagged: latestMeta?.flag === true,
      reasonText: typeof latestMeta?.reasonText === 'string' ? latestMeta.reasonText : null,
      hasOpenWork: (part.checklistItems?.length ?? 0) > 0,
    });
    existing.readyPartsCount += 1;
    orders.set(order.id, existing);
  });

  const items = Array.from(orders.values())
    .map((entry) => ({
      ...entry,
      readyParts: entry.readyParts.sort((a, b) => {
        if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
        const aPart = (a.partNumber ?? '').trim();
        const bPart = (b.partNumber ?? '').trim();
        if (aPart && bPart) return aPart.localeCompare(bPart, undefined, { numeric: true, sensitivity: 'base' });
        if (aPart) return -1;
        if (bPart) return 1;
        return a.id.localeCompare(b.id);
      }),
    }))
    .sort((a, b) => {
      const aFlagged = a.readyParts.some((part) => part.flagged);
      const bFlagged = b.readyParts.some((part) => part.flagged);
      if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true, sensitivity: 'base' });
    });

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
  if (!reasonCode && !reasonText?.trim()) {
    return fail(400, 'Reason is required for manual department transitions.');
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

  return ok({ ok: true });
}

export async function getOrderPrintData(orderId: string) {
  const order = await findOrderWithDetails(orderId);
  if (!order) return fail(404, 'Not found');

  const addons = await listAddons({ where: { active: true }, take: 200 });
  return ok({ order, addons });
}
