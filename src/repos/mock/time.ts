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

    async createTimeEntry(data: { userId: string; orderId: string; partId?: string | null; departmentId?: string | null; operation: string; startedAt?: Date }) {
      const startedAt = data.startedAt ?? new Date();
      const entry = {
        id: `time_entry_mock_${state.timeEntries.length + 1}`,
        userId: data.userId,
        orderId: data.orderId,
        partId: data.partId ?? null,
        departmentId: data.departmentId ?? null,
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

    async listActiveTimeEntriesForUser(userId: string) {
      return state.timeEntries.filter((entry) => entry.userId === userId && !entry.endedAt);
    },

    async listActiveTimeEntriesDetailed() {
      return state.timeEntries
        .filter((entry) => !entry.endedAt)
        .map((entry) => ({
          ...entry,
          user: state.users.find((user) => user.id === entry.userId) ?? null,
          order: state.orders.find((order) => order.id === entry.orderId) ?? null,
          part: state.orderParts.find((part) => part.id === entry.partId) ?? null,
          department: state.departments.find((department) => department.id === entry.departmentId) ?? null,
        }));
    },

    async listActiveTimeEntriesForPart(partId: string) {
      return state.timeEntries
        .filter((entry) => entry.partId === partId && !entry.endedAt)
        .map((entry) => ({
          ...entry,
          user: state.users.find((user) => user.id === entry.userId) ?? null,
        }));
    },

    async findActiveTimeEntryForUserDepartment(userId: string, departmentId: string) {
      return (
        state.timeEntries.find(
          (entry) => entry.userId === userId && entry.departmentId === departmentId && !entry.endedAt
        ) ?? null
      );
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


    async updateClosedTimeEntryById(id: string, data: { startedAt: Date; endedAt: Date }) {
      const entry = state.timeEntries.find((item) => item.id === id);
      if (!entry || !entry.endedAt) return null;
      entry.startedAt = data.startedAt;
      entry.endedAt = data.endedAt;
      entry.updatedAt = new Date();
      return entry;
    },

    async findTimeEntryById(entryId: string) {
      return state.timeEntries.find((entry) => entry.id === entryId) ?? null;
    },

    async listTimeEntriesForOrderParts(orderId: string, partIds: string[]) {
      return state.timeEntries.filter(
        (entry) => entry.orderId === orderId && entry.partId && partIds.includes(entry.partId) && entry.endedAt
      );
    },

    async listTimeEntriesForPartsDetailed(partIds: string[]) {
      return state.timeEntries
        .filter((entry) => entry.partId && partIds.includes(entry.partId))
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .map((entry) => ({
          ...entry,
          user: state.users.find((user) => user.id === entry.userId) ?? null,
          department: state.departments.find((department) => department.id === entry.departmentId) ?? null,
          actions: state.timeEntryActions
            .filter((action) => action.timeEntryId === entry.id)
            .map((action) => ({
              ...action,
              actor: action.actorUserId
                ? state.users.find((user) => user.id === action.actorUserId) ?? null
                : null,
            })),
        }));
    },

    async createTimeEntryWithAction(data: {
      orderId: string;
      partId: string;
      departmentId: string;
      workerUserId: string;
      actorUserId: string;
      operation: string;
      startedAt?: Date;
    }) {
      const activeEntry = state.timeEntries.find(
        (entry) => entry.userId === data.workerUserId && !entry.endedAt,
      ) ?? null;
      if (activeEntry) return { entry: null, activeEntry };

      const startedAt = data.startedAt ?? new Date();
      const entry = {
        id: `time_entry_mock_${state.timeEntries.length + 1}`,
        userId: data.workerUserId,
        orderId: data.orderId,
        partId: data.partId,
        departmentId: data.departmentId,
        operation: data.operation,
        startedAt,
        endedAt: null,
        createdAt: startedAt,
        updatedAt: startedAt,
      };
      state.timeEntries.unshift(entry);
      state.timeEntryActions.push({
        id: `time_action_mock_${state.timeEntryActions.length + 1}`,
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: 'START',
        reason: null,
        metadata: null,
        createdAt: startedAt,
      });
      return { entry, activeEntry: null };
    },

    async switchTimeEntryWithActions(data: {
      orderId: string;
      partId: string;
      departmentId: string;
      workerUserId: string;
      actorUserId: string;
      operation: string;
      switchedAt?: Date;
    }) {
      const switchedAt = data.switchedAt ?? new Date();
      const activeEntry = state.timeEntries.find(
        (entry) => entry.userId === data.workerUserId && !entry.endedAt,
      ) ?? null;
      if (activeEntry) {
        activeEntry.endedAt = switchedAt;
        activeEntry.updatedAt = switchedAt;
        state.timeEntryActions.push({
          id: `time_action_mock_${state.timeEntryActions.length + 1}`,
          timeEntryId: activeEntry.id,
          actorUserId: data.actorUserId,
          action: 'PAUSE',
          reason: 'Switched to urgent or higher-priority work.',
          metadata: JSON.stringify({ switchedToOrderId: data.orderId, switchedToPartId: data.partId }),
          createdAt: switchedAt,
        });
      }

      const entry = {
        id: `time_entry_mock_${state.timeEntries.length + 1}`,
        userId: data.workerUserId,
        orderId: data.orderId,
        partId: data.partId,
        departmentId: data.departmentId,
        operation: data.operation,
        startedAt: switchedAt,
        endedAt: null,
        createdAt: switchedAt,
        updatedAt: switchedAt,
      };
      state.timeEntries.unshift(entry);
      state.timeEntryActions.push({
        id: `time_action_mock_${state.timeEntryActions.length + 1}`,
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: activeEntry ? 'SWITCH_START' : 'START',
        reason: null,
        metadata: activeEntry ? JSON.stringify({ switchedFromEntryId: activeEntry.id }) : null,
        createdAt: switchedAt,
      });
      return {
        entry,
        previousEntry: activeEntry ? { ...activeEntry, endedAt: switchedAt } : null,
      };
    },

    async closeWorkerTimeEntryWithAction(data: {
      workerUserId: string;
      actorUserId: string;
      entryId?: string | null;
      action: 'PAUSE' | 'FINISH' | 'ADMIN_CLOSE';
      reason?: string | null;
      endedAt?: Date;
    }) {
      const entry = state.timeEntries.find(
        (item) =>
          item.userId === data.workerUserId &&
          !item.endedAt &&
          (!data.entryId || item.id === data.entryId),
      );
      if (!entry) return null;
      const endedAt = data.endedAt ?? new Date();
      entry.endedAt = endedAt;
      entry.updatedAt = endedAt;
      state.timeEntryActions.push({
        id: `time_action_mock_${state.timeEntryActions.length + 1}`,
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: data.action,
        reason: data.reason ?? null,
        metadata: null,
        createdAt: endedAt,
      });
      return entry;
    },

    async updateClosedTimeEntryWithAudit(data: {
      entryId: string;
      actorUserId: string;
      startedAt: Date;
      endedAt: Date;
      reason: string;
    }) {
      const entry = state.timeEntries.find((item) => item.id === data.entryId);
      if (!entry || !entry.endedAt) return null;
      const overlap = state.timeEntries.find(
        (item) =>
          item.id !== entry.id &&
          item.userId === entry.userId &&
          item.startedAt < data.endedAt &&
          (!item.endedAt || item.endedAt > data.startedAt),
      );
      if (overlap) return { entry: null, overlap };
      const before = { startedAt: entry.startedAt, endedAt: entry.endedAt };
      entry.startedAt = data.startedAt;
      entry.endedAt = data.endedAt;
      entry.updatedAt = new Date();
      state.timeEntryActions.push({
        id: `time_action_mock_${state.timeEntryActions.length + 1}`,
        timeEntryId: entry.id,
        actorUserId: data.actorUserId,
        action: 'CORRECT',
        reason: data.reason,
        metadata: JSON.stringify({
          before,
          after: { startedAt: data.startedAt, endedAt: data.endedAt },
        }),
        createdAt: new Date(),
      });
      return { entry, overlap: null };
    },
  };
}
