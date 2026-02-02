import { createMockSeedState } from './seed';

export function createMockTimeRepo() {
  const state = createMockSeedState();

  return {
    async closeTimeEntryById(id: string, endedAt: Date) {
      const entry = state.timeEntries.find((item) => item.id === id);
      if (!entry) return { count: 0 };
      if (entry.endedAt) return { count: 0 };
      entry.endedAt = endedAt;
      entry.updatedAt = endedAt;
      return { count: 1 };
    },

    async createTimeEntry(data: { userId: string; orderId: string; partId?: string | null; operation: string; startedAt?: Date }) {
      const startedAt = data.startedAt ?? new Date();
      const entry = {
        id: `time_entry_mock_${state.timeEntries.length + 1}`,
        userId: data.userId,
        orderId: data.orderId,
        partId: data.partId ?? null,
        operation: data.operation,
        startedAt,
        endedAt: null,
        createdAt: startedAt,
        updatedAt: startedAt,
      };
      state.timeEntries.unshift(entry);
      return entry;
    },

    async findActiveTimeEntryForUser(userId: string) {
      return state.timeEntries.find((entry) => entry.userId === userId && !entry.endedAt) ?? null;
    },

    async findLatestTimeEntriesForUserParts(userId: string, partIds: string[]) {
      const entries = state.timeEntries.filter(
        (entry) => entry.userId === userId && entry.partId && partIds.includes(entry.partId)
      );
      return entries.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    },

    async findLatestTimeEntryForUserOrder(userId: string, orderId: string, partId?: string | null) {
      const entries = state.timeEntries.filter(
        (entry) =>
          entry.userId === userId &&
          entry.orderId === orderId &&
          (partId === undefined || entry.partId === partId)
      );
      return entries.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
    },

    async findTimeEntryById(entryId: string) {
      return state.timeEntries.find((entry) => entry.id === entryId) ?? null;
    },

    async listTimeEntriesForOrderParts(orderId: string, partIds: string[]) {
      return state.timeEntries.filter(
        (entry) => entry.orderId === orderId && entry.partId && partIds.includes(entry.partId) && entry.endedAt
      );
    },
  };
}
