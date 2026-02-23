import 'server-only';

import { prisma } from '@/lib/prisma';
import type { CustomerWriteInput } from './customers.types';

export function listCustomers(take: number) {
  return prisma.customer.findMany({ take });
}

export function createCustomer(data: Required<Pick<CustomerWriteInput, 'name'>> & Omit<CustomerWriteInput, 'name'>) {
  return prisma.customer.create({ data });
}

export function updateCustomer(id: string, data: CustomerWriteInput) {
  return prisma.customer.update({ where: { id }, data });
}

export function listCustomersWithOrders() {
  return prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      orders: {
        include: { parts: { select: { quantity: true } } },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });
}

export function findCustomerDetailById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
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
