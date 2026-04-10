import { createMockSeedState } from './seed';

export function createMockUsersRepo() {
  const state = createMockSeedState();

  function sanitizeUser<T extends Record<string, unknown>>(item: T) {
    const { kioskPinHash, ...rest } = item as T & { kioskPinHash?: unknown };
    return rest;
  }

  return {
    async listUsers({ q, role, take, cursor }: { q?: string; role?: string; take: number; cursor?: string | null }) {
      let items = [...state.users];
      if (q) {
        const query = q.toLowerCase();
        items = items.filter((user) => user.name?.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
      }
      if (role) {
        items = items.filter((user) => user.role === role);
      }
      if (cursor) {
        const index = items.findIndex((user) => user.id === cursor);
        if (index >= 0) {
          items = items.slice(index + 1);
        }
      }
      const sliced = items.slice(0, take + 1);
      const nextCursor = sliced.length > take ? sliced[take].id : null;
      if (nextCursor) sliced.pop();
      return { items: sliced.map((item) => sanitizeUser(item)), nextCursor };
    },

    async createUser(data: Record<string, unknown>) {
      const user = {
        id: `user_mock_${state.users.length + 1}`,
        name: (data.name as string) ?? null,
        email: (data.email as string) ?? `user${state.users.length + 1}@local`,
        role: (data.role as string) ?? 'MACHINIST',
        admin: Boolean(data.admin ?? false),
        active: data.active !== false,
        kioskEnabled: Boolean(data.kioskEnabled ?? false),
        kioskPinHash: (data.kioskPinHash as string) ?? null,
        primaryDepartmentId: (data.primaryDepartmentId as string) ?? null,
        primaryDepartment:
          state.departments.find((department) => department.id === data.primaryDepartmentId) ?? null,
      };
      state.users.push(user);
      return sanitizeUser(user);
    },

    async updateUser(id: string, data: Record<string, unknown>) {
      const user = state.users.find((item) => item.id === id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      user.primaryDepartment =
        state.departments.find((department) => department.id === user.primaryDepartmentId) ?? null;
      return sanitizeUser(user);
    },

    async findUserById(id: string) {
      return state.users.find((user) => user.id === id) ?? null;
    },

    async findUserByKioskId(id: string) {
      return state.users.find((user) => user.id === id) ?? null;
    },

    async findKioskUserByPinEligibility(emailOrId: { id?: string; email?: string }) {
      return (
        state.users.find(
          (user) =>
            user.active !== false &&
            (emailOrId.id ? user.id === emailOrId.id : true) &&
            (emailOrId.email ? user.email === emailOrId.email : true),
        ) ?? null
      );
    },

    async listKioskUsers() {
      return state.users
        .filter((user) => user.active !== false)
        .map((user) => ({ ...user }));
    },
  };
}
