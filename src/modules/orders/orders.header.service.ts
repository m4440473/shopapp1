import 'server-only';

import type { z } from 'zod';

import { resolveCustomerContactSnapshot } from '@/modules/customers/customers.service';
import { findOrderCustomerIdentity, updateOrder } from '@/repos/orders';
import { OrderUpdate } from './orders.schema';

type OrderUpdateInput = z.infer<typeof OrderUpdate>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}
function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function updateOrderDetails(id: string, payload: OrderUpdateInput) {
  const data: Record<string, unknown> = {};

  if (payload.business !== undefined) data.business = payload.business;

  if (payload.customerId !== undefined || payload.customerContactId !== undefined) {
    const currentIdentity = await findOrderCustomerIdentity(id);
    if (!currentIdentity) return fail(404, 'Order not found');
    const targetCustomerId = payload.customerId ?? currentIdentity.customerId;

    if (payload.customerId !== undefined) data.customerId = payload.customerId;
    if (payload.customerContactId !== undefined) {
      try {
        const contact = await resolveCustomerContactSnapshot(targetCustomerId, payload.customerContactId);
        data.customerContactId = contact?.customerContactId ?? null;
        data.contactName = contact?.contactName ?? null;
        data.contactEmail = contact?.contactEmail ?? null;
        data.contactPhone = contact?.contactPhone ?? null;
      } catch (error) {
        return fail(400, error instanceof Error ? error.message : 'Invalid customer contact.');
      }
    } else if (payload.customerId !== undefined && payload.customerId !== currentIdentity.customerId) {
      data.customerContactId = null;
      data.contactName = null;
      data.contactEmail = null;
      data.contactPhone = null;
    }
  }

  if (payload.receivedDate !== undefined) {
    const date = new Date(payload.receivedDate);
    if (Number.isNaN(date.getTime())) return fail(400, 'Invalid received date');
    data.receivedDate = date;
  }

  if (payload.dueDate !== undefined) {
    const date = new Date(payload.dueDate);
    if (Number.isNaN(date.getTime())) return fail(400, 'Invalid due date');
    data.dueDate = date;
  }

  if (payload.priority !== undefined) data.priority = payload.priority;
  if (payload.vendorId !== undefined) data.vendorId = payload.vendorId || null;
  if (payload.poNumber !== undefined) data.poNumber = payload.poNumber || null;
  if (payload.materialNeeded !== undefined) data.materialNeeded = payload.materialNeeded;
  if (payload.materialOrdered !== undefined) data.materialOrdered = payload.materialOrdered;
  if (payload.modelIncluded !== undefined) data.modelIncluded = payload.modelIncluded;
  if (payload.assignedMachinistId !== undefined) data.assignedMachinistId = payload.assignedMachinistId || null;

  if (Object.keys(data).length === 0) return fail(400, 'No fields to update');

  await updateOrder(id, data);
  return ok({ ok: true });
}
