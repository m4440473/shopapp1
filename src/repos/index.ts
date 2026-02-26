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

function shouldUseMockRepos() {
  return isTestMode() && process.env.TEST_MODE_USE_MOCK_REPOS === 'true';
}

export function getOrdersRepo(): OrdersRepo {
  if (!shouldUseMockRepos()) {
    return prismaOrdersRepo;
  }
  if (!mockOrdersRepo) {
    mockOrdersRepo = createMockOrdersRepo();
  }
  return mockOrdersRepo;
}

export function getTimeRepo(): TimeRepo {
  if (!shouldUseMockRepos()) {
    return prismaTimeRepo;
  }
  if (!mockTimeRepo) {
    mockTimeRepo = createMockTimeRepo();
  }
  return mockTimeRepo;
}

export function getUsersRepo(): UsersRepo {
  if (!shouldUseMockRepos()) {
    return prismaUsersRepo;
  }
  if (!mockUsersRepo) {
    mockUsersRepo = createMockUsersRepo();
  }
  return mockUsersRepo;
}
