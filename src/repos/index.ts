import { isTestMode } from '@/lib/testMode';
import * as prismaOrdersRepo from '@/modules/orders/orders.repo';
import * as prismaTimeRepo from '@/modules/time/time.repo';
import * as prismaUsersRepo from '@/modules/users/users.repo';
import { createMockOrdersRepo } from '@/repos/mock/orders';
import { createMockTimeRepo } from '@/repos/mock/time';
import { createMockUsersRepo } from '@/repos/mock/users';

export type OrdersRepo = typeof prismaOrdersRepo;
export type TimeRepo = typeof prismaTimeRepo;
export type UsersRepo = typeof prismaUsersRepo;

let mockOrdersRepo: OrdersRepo | null = null;
let mockTimeRepo: TimeRepo | null = null;
let mockUsersRepo: UsersRepo | null = null;

export function getOrdersRepo(): OrdersRepo {
  if (!isTestMode()) {
    return prismaOrdersRepo;
  }
  if (!mockOrdersRepo) {
    mockOrdersRepo = createMockOrdersRepo();
  }
  return mockOrdersRepo;
}

export function getTimeRepo(): TimeRepo {
  if (!isTestMode()) {
    return prismaTimeRepo;
  }
  if (!mockTimeRepo) {
    mockTimeRepo = createMockTimeRepo();
  }
  return mockTimeRepo;
}

export function getUsersRepo(): UsersRepo {
  if (!isTestMode()) {
    return prismaUsersRepo;
  }
  if (!mockUsersRepo) {
    mockUsersRepo = createMockUsersRepo();
  }
  return mockUsersRepo;
}
