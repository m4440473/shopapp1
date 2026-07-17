export type LaborHistoryPerson = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type LaborHistoryAction = {
  action: string;
  createdAt: Date | string;
  reason?: string | null;
  actor?: LaborHistoryPerson | null;
};

export type PartLaborHistoryEntry = {
  id: string;
  userId: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  operation?: string | null;
  user?: LaborHistoryPerson | null;
  department?: { id: string; name?: string | null } | null;
  actions?: LaborHistoryAction[];
};

export type GroupedLaborAction = LaborHistoryAction & {
  createdAtMs: number;
};

export type GroupedLaborInterval = Omit<PartLaborHistoryEntry, 'actions'> & {
  startedAtMs: number;
  endedAtMs: number | null;
  durationSeconds: number;
  isRunning: boolean;
  actions: GroupedLaborAction[];
};

export type EmployeeLaborGroup = {
  userId: string;
  user: LaborHistoryPerson | null;
  label: string;
  closedSeconds: number;
  runningSeconds: number;
  totalSeconds: number;
  intervals: GroupedLaborInterval[];
};

export type PartLaborHistorySummary = {
  closedSeconds: number;
  runningSeconds: number;
  totalSeconds: number;
  activeTimerCount: number;
  employees: EmployeeLaborGroup[];
};

function toTimestamp(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getLaborPersonLabel(person: LaborHistoryPerson | null | undefined, fallback = 'Unknown employee') {
  const name = person?.name?.trim();
  if (name) return name;
  const email = person?.email?.trim();
  if (email) return email;
  return fallback;
}

export function formatLaborDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  if (minutes > 0) return `${minutes} min`;
  return '< 1 min';
}

export function groupPartLaborHistory(
  entries: PartLaborHistoryEntry[],
  nowMs = Date.now(),
): PartLaborHistorySummary {
  const groups = new Map<string, EmployeeLaborGroup>();

  entries.forEach((entry) => {
    const startedAtMs = toTimestamp(entry.startedAt);
    if (startedAtMs === null) return;

    const endedAtMs = toTimestamp(entry.endedAt);
    const isRunning = entry.endedAt === null;
    if (!isRunning && (endedAtMs === null || endedAtMs <= startedAtMs)) return;

    const durationSeconds = Math.max(
      0,
      Math.floor(((isRunning ? nowMs : endedAtMs!) - startedAtMs) / 1000),
    );
    const groupKey = entry.userId || `unknown:${entry.id}`;
    const user = entry.user ?? null;
    const actions = (entry.actions ?? [])
      .map((action) => {
        const createdAtMs = toTimestamp(action.createdAt);
        return createdAtMs === null ? null : { ...action, createdAtMs };
      })
      .filter((action): action is GroupedLaborAction => action !== null)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    const interval: GroupedLaborInterval = {
      ...entry,
      user,
      startedAtMs,
      endedAtMs: isRunning ? null : endedAtMs,
      durationSeconds,
      isRunning,
      actions,
    };
    const existing = groups.get(groupKey);

    if (existing) {
      existing.intervals.push(interval);
      if (isRunning) existing.runningSeconds += durationSeconds;
      else existing.closedSeconds += durationSeconds;
      existing.totalSeconds = existing.closedSeconds + existing.runningSeconds;
      if (!existing.user && user) {
        existing.user = user;
        existing.label = getLaborPersonLabel(user, entry.userId || 'Unknown employee');
      }
      return;
    }

    groups.set(groupKey, {
      userId: entry.userId,
      user,
      label: getLaborPersonLabel(user, entry.userId || 'Unknown employee'),
      closedSeconds: isRunning ? 0 : durationSeconds,
      runningSeconds: isRunning ? durationSeconds : 0,
      totalSeconds: durationSeconds,
      intervals: [interval],
    });
  });

  const employees = Array.from(groups.values());
  employees.forEach((employee) => {
    employee.intervals.sort((a, b) => b.startedAtMs - a.startedAtMs);
  });
  employees.sort((a, b) => {
    const aRunning = a.runningSeconds > 0 ? 1 : 0;
    const bRunning = b.runningSeconds > 0 ? 1 : 0;
    if (aRunning !== bRunning) return bRunning - aRunning;
    if (a.totalSeconds !== b.totalSeconds) return b.totalSeconds - a.totalSeconds;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return employees.reduce<PartLaborHistorySummary>(
    (summary, employee) => {
      summary.closedSeconds += employee.closedSeconds;
      summary.runningSeconds += employee.runningSeconds;
      summary.totalSeconds += employee.totalSeconds;
      summary.activeTimerCount += employee.intervals.filter((interval) => interval.isRunning).length;
      return summary;
    },
    { closedSeconds: 0, runningSeconds: 0, totalSeconds: 0, activeTimerCount: 0, employees },
  );
}
