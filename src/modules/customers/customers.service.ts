import 'server-only';

import {
  customerCreateSchema,
  customerUpdateSchema,
  type CustomerContactInput,
  type CustomerCreateInput,
  type CustomerUpdateInput,
} from './customers.schema';
import {
  createCustomer,
  findCustomerContactById,
  findCustomerDetailById,
  listCustomers,
  listCustomersWithOrders,
  updateCustomer,
} from './customers.repo';
import type { CustomerContactWriteInput, CustomerWriteInput, StructuredCustomerAddress } from './customers.types';
import { buildCustomerDashboardRecords } from './customer-dashboard';

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

export function formatCustomerShippingAddress(
  customer: StructuredCustomerAddress & { address?: string | null },
) {
  const city = customer.city?.trim();
  const regionPostal = [customer.stateProvince?.trim(), customer.postalCode?.trim()].filter(Boolean).join(' ');
  const locality = [city, regionPostal].filter(Boolean).join(', ');
  const structured = [customer.addressLine1, customer.addressLine2, locality, customer.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return structured.length ? structured.join('\n') : customer.address?.trim() || null;
}

function hasLegacyContact(payload: { contact?: string; phone?: string; fax?: string; email?: string }) {
  return Boolean(payload.contact?.trim() || payload.phone?.trim() || payload.fax?.trim() || payload.email?.trim());
}

export function normalizeCustomerContacts(
  contacts: CustomerContactInput[] | undefined,
  legacy?: { contact?: string; phone?: string; fax?: string; email?: string },
): CustomerContactWriteInput[] | undefined {
  const source = contacts !== undefined
    ? contacts
    : legacy && hasLegacyContact(legacy)
      ? [{
          name: legacy.contact?.trim() || legacy.email?.trim() || 'Primary contact',
          phone: legacy.phone,
          fax: legacy.fax,
          email: legacy.email,
          isPrimary: true,
        }]
      : undefined;
  if (source === undefined) return undefined;

  const requestedPrimary = source.findIndex((contact) => contact.isPrimary);
  const primaryIndex = source.length ? Math.max(0, requestedPrimary) : -1;
  return source.map((contact, index) => ({
    id: contact.id?.trim() || undefined,
    name: contact.name.trim(),
    title: normalizeOptional(contact.title),
    phone: normalizeOptional(contact.phone),
    fax: normalizeOptional(contact.fax),
    email: normalizeOptional(contact.email),
    isPrimary: index === primaryIndex,
    sortOrder: index,
  }));
}

function structuredAddressWasSubmitted(payload: CustomerCreateInput | CustomerUpdateInput) {
  return ['addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country'].some(
    (key) => key in payload,
  );
}

function addressFields(payload: CustomerCreateInput | CustomerUpdateInput) {
  return {
    addressLine1: normalizeOptional(payload.addressLine1),
    addressLine2: normalizeOptional(payload.addressLine2),
    city: normalizeOptional(payload.city),
    stateProvince: normalizeOptional(payload.stateProvince),
    postalCode: normalizeOptional(payload.postalCode),
    country: normalizeOptional(payload.country),
  };
}

export function parseCustomerCreatePayload(payload: unknown) {
  return customerCreateSchema.safeParse(payload);
}

export function parseCustomerUpdatePayload(payload: unknown) {
  return customerUpdateSchema.safeParse(payload);
}

export function buildCustomerCreateData(payload: CustomerCreateInput): CustomerWriteInput & { name: string } {
  const contacts = normalizeCustomerContacts(payload.contacts, payload);
  const primary = contacts?.find((contact) => contact.isPrimary);
  const structured = addressFields(payload);
  return {
    name: payload.name,
    contact: primary ? primary.name : normalizeOptional(payload.contact),
    phone: primary ? primary.phone ?? null : normalizeOptional(payload.phone),
    fax: primary ? primary.fax ?? null : normalizeOptional(payload.fax),
    email: primary ? primary.email ?? null : normalizeOptional(payload.email),
    address: formatCustomerShippingAddress({ ...structured, address: payload.address }),
    ...structured,
    contacts,
  };
}

export function buildCustomerUpdateData(payload: CustomerUpdateInput): CustomerWriteInput {
  const data: CustomerWriteInput = {};
  if (payload.name !== undefined) data.name = payload.name;

  const contacts = normalizeCustomerContacts(payload.contacts);
  if (contacts !== undefined) {
    data.contacts = contacts;
    const primary = contacts.find((contact) => contact.isPrimary);
    data.contact = primary?.name ?? null;
    data.phone = primary?.phone ?? null;
    data.fax = primary?.fax ?? null;
    data.email = primary?.email ?? null;
  } else {
    if (payload.contact !== undefined) data.contact = normalizeOptional(payload.contact);
    if (payload.phone !== undefined) data.phone = normalizeOptional(payload.phone);
    if (payload.fax !== undefined) data.fax = normalizeOptional(payload.fax);
    if (payload.email !== undefined) data.email = normalizeOptional(payload.email);
  }

  if (structuredAddressWasSubmitted(payload)) {
    const structured = addressFields(payload);
    Object.assign(data, structured);
    data.address = formatCustomerShippingAddress({ ...structured, address: payload.address });
  } else if (payload.address !== undefined) {
    data.address = normalizeOptional(payload.address);
  }
  return data;
}

export async function listCustomersForAdmin(take: number) {
  return listCustomers(take);
}

export async function createCustomerFromInput(payload: CustomerCreateInput) {
  return createCustomer(buildCustomerCreateData(payload));
}

export async function updateCustomerFromInput(id: string, payload: CustomerUpdateInput) {
  return updateCustomer(id, buildCustomerUpdateData(payload));
}

export async function resolveCustomerContactSnapshot(customerId: string, contactId?: string | null) {
  if (!contactId) return null;
  const contact = await findCustomerContactById(contactId);
  if (!contact || contact.customerId !== customerId) {
    throw new Error('The selected contact does not belong to this customer.');
  }
  return {
    customerContactId: contact.id,
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: contact.phone,
  };
}

export async function listCustomerDashboardCards() {
  const customers = await listCustomersWithOrders();
  return buildCustomerDashboardRecords(customers);
}

export async function getCustomerDetail(id: string) {
  return findCustomerDetailById(id);
}
