import 'server-only';

import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import {
  createOrderCharge,
  deleteOrderChargeWithChecklist,
  findAddonDepartment,
  findDepartmentById,
  findOrderById,
  findOrderCharge,
  findOrderPartSummary,
  listOrderCharges,
  syncChecklistForOrder,
  updateOrderCharge,
} from '@/repos/orders';
import { OrderChargeCreate, OrderChargeUpdate } from './orders.schema';

export type OrderChargeCreateInput = z.infer<typeof OrderChargeCreate>;
export type OrderChargeUpdateInput = z.infer<typeof OrderChargeUpdate>;

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

type ChargeLifecycle = {
  initializePartDepartments(orderId: string): Promise<unknown>;
  syncWorkflowStatus(orderId: string): Promise<unknown>;
};

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

export async function listChargesForOrder(orderId: string) {
  const order = await findOrderById(orderId);
  if (!order) return fail(404, 'Order not found');

  const charges = await listOrderCharges(orderId);
  return ok({ charges: charges.map(serializeCharge) });
}

export async function createChargeForOrderCommand(
  {
    orderId,
    payload,
  }: {
    orderId: string;
    payload: OrderChargeCreateInput;
  },
  lifecycle: ChargeLifecycle,
) {
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
  await lifecycle.initializePartDepartments(orderId);
  await lifecycle.syncWorkflowStatus(orderId);
  return ok({ charge: serializeCharge(charge) });
}

export async function updateChargeForOrderCommand(
  {
    orderId,
    chargeId,
    payload,
  }: {
    orderId: string;
    chargeId: string;
    payload: OrderChargeUpdateInput;
  },
  lifecycle: ChargeLifecycle,
) {
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
  await lifecycle.initializePartDepartments(orderId);
  await lifecycle.syncWorkflowStatus(orderId);
  return ok({ charge: serializeCharge(updated) });
}

export async function deleteChargeForOrderCommand(
  { orderId, chargeId }: { orderId: string; chargeId: string },
  lifecycle: Pick<ChargeLifecycle, 'syncWorkflowStatus'>,
) {
  const charge = await findOrderCharge(orderId, chargeId);
  if (!charge) return fail(404, 'Charge not found');

  await deleteOrderChargeWithChecklist(chargeId);
  await syncChecklistForOrder(orderId);
  await lifecycle.syncWorkflowStatus(orderId);
  return ok({ ok: true });
}
