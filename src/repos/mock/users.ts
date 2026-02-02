import { createMockSeedState } from './seed';

export function createMockUsersRepo() {
  const state = createMockSeedState();

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
      return { items: sliced, nextCursor };
    },

    async createUser(data: Record<string, unknown>) {
      const user = {
        id: `user_mock_${state.users.length + 1}`,
        name: (data.name as string) ?? null,
        email: (data.email as string) ?? `user${state.users.length + 1}@local`,
        role: (data.role as string) ?? 'MACHINIST',
        admin: Boolean(data.admin ?? false),
        active: data.active !== false,
      };
      state.users.push(user);
      return user;
    },

    async updateUser(id: string, data: Record<string, unknown>) {
      const user = state.users.find((item) => item.id === id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return user;
    },

    async findUserById(id: string) {
      return state.users.find((user) => user.id === id) ?? null;
    },
  };
}
