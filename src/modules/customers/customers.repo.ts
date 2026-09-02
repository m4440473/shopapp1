import 'server-only';

import { prisma } from '@/lib/prisma';
import type { CustomerWriteInput } from './customers.types';

const contactsOrderBy = [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }, { name: 'asc' as const }];

export function listCustomers(take: number) {
  return prisma.customer.findMany({
    take,
    orderBy: { name: 'asc' },
    include: { contacts: { orderBy: contactsOrderBy }, businesses: { orderBy: { businessCode: 'asc' } } },
  });
}

export function findCustomerContactById(id: string) {
  return prisma.customerContact.findUnique({ where: { id } });
}

export function createCustomer(
  data: Required<Pick<CustomerWriteInput, 'name'>> & Omit<CustomerWriteInput, 'name'>,
) {
  const { contacts = [], ...customerData } = data;
  return prisma.customer.create({
    data: {
      ...customerData,
      contacts: contacts.length
        ? { create: contacts.map(({ id: _id, ...contact }) => contact) }
        : undefined,
    },
    include: { contacts: { orderBy: contactsOrderBy }, businesses: { orderBy: { businessCode: 'asc' } } },
  });
}

export function updateCustomer(id: string, data: CustomerWriteInput) {
  const { contacts, ...customerData } = data;
  return prisma.$transaction(async (tx) => {
    if (contacts !== undefined) {
      const retainedIds = contacts.flatMap((contact) => (contact.id ? [contact.id] : []));
      if (retainedIds.length) {
        const ownedContacts = await tx.customerContact.findMany({
          where: { customerId: id, id: { in: retainedIds } },
          select: { id: true },
        });
        if (ownedContacts.length !== new Set(retainedIds).size) {
          throw new Error('One or more contacts do not belong to this customer.');
        }
      }
      await tx.customerContact.deleteMany({
        where: {
          customerId: id,
          ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
        },
      });

      for (const contact of contacts) {
        const { id: contactId, ...contactData } = contact;
        if (contactId) {
          await tx.customerContact.updateMany({
            where: { id: contactId, customerId: id },
            data: contactData,
          });
        } else {
          await tx.customerContact.create({ data: { ...contactData, customerId: id } });
        }
      }
    }

    return tx.customer.update({
      where: { id },
      data: customerData,
      include: { contacts: { orderBy: contactsOrderBy }, businesses: { orderBy: { businessCode: 'asc' } } },
    });
  });
}

export function listCustomersWithOrders() {
  return prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      contacts: { orderBy: contactsOrderBy },
      businesses: { orderBy: { businessCode: 'asc' } },
      orders: {
        include: {
          parts: { select: { quantity: true } },
          timeEntries: { select: { startedAt: true, endedAt: true } },
        },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });
}

export function findCustomerDetailById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: contactsOrderBy },
      businesses: { orderBy: { businessCode: 'asc' } },
      orders: {
        include: {
          assignedMachinist: { select: { id: true, name: true, email: true } },
          parts: { select: { quantity: true } },
        },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });
}
