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
  findOrderCharge,
  findOrderPart,
  findOrderPartSummary,
  findOrderPartWithCharges,
  findOrderStatus,
  findOrderSummary,
  findOrderWithDetails,
  findPartAttachment,
  findPartById,
  findPartWithOrderInfo,
  findUserById,
  listAddons,
  listChecklistItems,
  listDepartmentsOrdered,
  listOrderCharges,
  listOrders,
  listOrderPartsByIds,
  listReadyOrderPartsForDepartment,
  listPartAttachments,
  moveOrderPartsToDepartment,
  updateChecklistCompletion,
  updateOrder,
  updateOrderAssignee,
  updateOrderCharge,
  updateOrderPart,
  updatePartAttachment,
  updateOrderStatus,
  generateNextOrderNumber,
  syncChecklistForOrder,
} from './orders.repo';

export { generateNextOrderNumber, syncChecklistForOrder };
export type { OrderFilterState, OrderListItem, OrderWithMeta };
export { isPartReadyForDepartment };

export type DepartmentFeedPart = { id: string; partNumber: string | null; quantity: number | null };
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

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
        checklist: body.addonIds.length ? { create: body.addonIds.map((id) => ({ addonId: id })) } : undefined,
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
      select: { id: true },
    },
    customFieldValues: normalizedCustomFieldValues,
  });

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

export async function addOrderNote(orderId: string, userId: string, content: string) {
  const note = await createOrderNote(orderId, userId, content.trim());
  return ok({ note });
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
}: {
  orderId: string;
  checklistId?: string;
  chargeId?: string;
  addonId?: string;
  partId?: string;
  checked: boolean;
  employeeName: string;
  togglerId?: string;
}) {
  if (!checklistId && !chargeId && !addonId) {
    return fail(400, 'Missing checklistId');
  }
  if (typeof checked !== 'boolean') return fail(400, 'Missing checked state');
  if (!employeeName) return fail(400, 'Employee name is required');

  const orderExists = await findOrderById(orderId);
  if (!orderExists) return fail(404, 'Order not found');

  const existingChecklist = checklistId
    ? await findChecklistById(checklistId)
    : chargeId
      ? await findChecklistByCharge(orderId, chargeId)
      : await findChecklistByAddon(orderId, addonId as string, typeof partId === 'string' ? partId : null);
  if (!existingChecklist || existingChecklist.orderId !== orderId) {
    return fail(404, 'Checklist item not found');
  }

  const charge = existingChecklist.chargeId ? await findChargeById(existingChecklist.chargeId) : null;

  const addonExists = existingChecklist.addonId ? await findAddonById(existingChecklist.addonId) : null;

  if (existingChecklist.chargeId && !charge) {
    return fail(404, 'Charge not found');
  }
  if (existingChecklist.addonId && !addonExists) {
    return fail(404, 'Addon not found');
  }

  const previousState = existingChecklist?.completed ?? false;

  const toggler = togglerId ? await findUserById(togglerId) : null;
  const toggledById = toggler ? toggler.id : null;

  await updateChecklistCompletion({
    checklistId: existingChecklist.id,
    checked,
    toggledById,
    chargeId: existingChecklist.chargeId,
  });

  const label = charge?.name ?? addonExists?.name ?? 'Checklist';

  await createStatusHistoryEntry({
    orderId,
    from: `${label} ${previousState ? 'checked' : 'unchecked'}`,
    to: `${label} ${checked ? 'checked' : 'unchecked'}`,
    userId: toggledById ?? undefined,
    reason: `Checklist "${label}" ${checked ? 'checked' : 'unchecked'} by ${employeeName}`,
  });

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

  if (payload.partId) {
    const part = await findOrderPartSummary(orderId, payload.partId);
    if (!part) return fail(404, 'Part not found on order');
  }

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
      partId: payload.partId ?? null,
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

  const nextKind = payload.kind ?? charge.kind;
  const nextPartId = payload.partId !== undefined ? payload.partId : charge.partId;

  if ((nextKind === 'LABOR' || nextKind === 'ADDON') && !nextPartId) {
    return fail(400, 'partId is required for labor or addon charges.');
  }

  if (payload.partId) {
    const part = await findOrderPartSummary(orderId, payload.partId);
    if (!part) return fail(404, 'Part not found on order');
  }

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
  if (payload.partId !== undefined) data.partId = payload.partId ?? null;
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
}: {
  partId: string;
  payload: PartAttachmentCreateInput;
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

export async function getOrderDepartmentFeed(
  departmentId: string,
): Promise<ServiceResult<{ items: DepartmentFeedOrder[] }>> {
  if (!departmentId) return fail(400, 'Department is required');
  const readyParts = await listReadyOrderPartsForDepartment(departmentId);
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
    existing.readyParts.push({
      id: part.id,
      partNumber: part.partNumber ?? null,
      quantity: part.quantity ?? null,
    });
    existing.readyPartsCount += 1;
    orders.set(order.id, existing);
  });

  const items = Array.from(orders.values()).sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return aDue - bDue;
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
}: {
  orderId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  partIds: string[];
  employeeName: string;
  togglerId?: string;
}) {
  if (!orderId) return fail(400, 'Order is required');
  if (!fromDepartmentId) return fail(400, 'Missing fromDepartmentId');
  if (!toDepartmentId) return fail(400, 'Missing toDepartmentId');
  if (!Array.isArray(partIds) || partIds.length === 0) return fail(400, 'No parts selected');
  if (!employeeName) return fail(400, 'Employee name is required');

  const orderExists = await findOrderById(orderId);
  if (!orderExists) return fail(404, 'Order not found');

  const targetDepartment = await findActiveDepartmentById(toDepartmentId);
  if (!targetDepartment) return fail(400, 'Target department not found');

  const parts = await listOrderPartsByIds(orderId, partIds);
  if (parts.length !== partIds.length) return fail(404, 'Part not found in order');

  const invalidPart = parts.find((part) => part.currentDepartmentId !== fromDepartmentId);
  if (invalidPart) return fail(400, 'Part is not in the expected department');

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

  return ok({ ok: true });
}

export async function getOrderPrintData(orderId: string) {
  const order = await findOrderWithDetails(orderId);
  if (!order) return fail(404, 'Not found');

  const addons = await listAddons({ where: { active: true }, take: 200 });
  return ok({ order, addons });
}
