import 'server-only';

import { customerCreateSchema, customerUpdateSchema, type CustomerCreateInput, type CustomerUpdateInput } from './customers.schema';
import { createCustomer, findCustomerDetailById, listCustomers, listCustomersWithOrders, updateCustomer } from './customers.repo';

function normalizeOptional(value: string | undefined) {
  if (value === undefined) return undefined;
  return value || null;
}

export function parseCustomerCreatePayload(payload: unknown) {
  return customerCreateSchema.safeParse(payload);
}

export function parseCustomerUpdatePayload(payload: unknown) {
  return customerUpdateSchema.safeParse(payload);
}

export function buildCustomerCreateData(payload: CustomerCreateInput) {
  return {
    name: payload.name,
    contact: normalizeOptional(payload.contact),
    phone: normalizeOptional(payload.phone),
    email: normalizeOptional(payload.email),
    address: normalizeOptional(payload.address),
  };
}

export function buildCustomerUpdateData(payload: CustomerUpdateInput) {
  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.contact !== undefined) data.contact = payload.contact || null;
  if (payload.phone !== undefined) data.phone = payload.phone || null;
  if (payload.email !== undefined) data.email = payload.email || null;
  if (payload.address !== undefined) data.address = payload.address || null;
  return data;
}

export async function listCustomersForAdmin(take: number) {
  return listCustomers(take);
}

export async function createCustomerFromInput(payload: CustomerCreateInput) {
  return createCustomer(buildCustomerCreateData(payload));
}

export async function updateCustomerFromInput(id: string, payload: CustomerUpdateInput) {
  const data = buildCustomerUpdateData(payload);
  return updateCustomer(id, data);
}

export async function listCustomerDashboardCards() {
  return listCustomersWithOrders();
}

export async function getCustomerDetail(id: string) {
  return findCustomerDetailById(id);
}
