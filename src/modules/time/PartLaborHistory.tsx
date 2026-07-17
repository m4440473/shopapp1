'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  formatLaborDuration,
  getLaborPersonLabel,
  groupPartLaborHistory,
  type GroupedLaborInterval,
  type PartLaborHistoryEntry,
} from './part-labor-history';

type PartLaborHistoryProps = {
  entries: PartLaborHistoryEntry[];
  title?: string;
  emptyMessage?: string;
};

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getIntervalLabel(interval: GroupedLaborInterval) {
  return interval.operation?.trim() || interval.department?.name?.trim() || 'Shop work';
}

function getActionLabel(action: string) {
  const normalized = action.trim().replaceAll('_', ' ').toLowerCase();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : 'Updated';
}

export function PartLaborHistory({
  entries,
  title = 'Labor history',
  emptyMessage = 'No labor has been recorded for this part yet.',
}: PartLaborHistoryProps) {
  const hasRunningTimer = entries.some((entry) => entry.endedAt === null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hasRunningTimer) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunningTimer]);

  const summary = useMemo(() => groupPartLaborHistory(entries, nowMs), [entries, nowMs]);

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border/70 bg-muted/15 p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-foreground" aria-live="polite">
            {formatLaborDuration(summary.totalSeconds)}
          </div>
          <div className="text-xs text-muted-foreground">
            Total across {summary.employees.length} {summary.employees.length === 1 ? 'employee' : 'employees'}
          </div>
        </div>
        {summary.activeTimerCount > 0 ? (
          <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
            {summary.activeTimerCount} running now
          </Badge>
        ) : null}
      </div>

      {summary.employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {summary.employees.map((employee) => (
            <details
              key={employee.userId || employee.label}
              className="group rounded-lg border border-border/70 bg-background"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{employee.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {employee.intervals.length} {employee.intervals.length === 1 ? 'work interval' : 'work intervals'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {employee.runningSeconds > 0 ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Running
                    </span>
                  ) : null}
                  <span className="text-base font-bold tabular-nums text-foreground">
                    {formatLaborDuration(employee.totalSeconds)}
                  </span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                </div>
              </summary>

              <div className="border-t border-border/60 px-4 py-2">
                {employee.intervals.map((interval) => (
                  <div key={interval.id} className="border-b border-border/50 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">{getIntervalLabel(interval)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(interval.startedAtMs)}
                          {interval.endedAtMs ? ` – ${formatDateTime(interval.endedAtMs)}` : ' – now'}
                        </div>
                        {interval.department?.name && interval.operation?.trim() ? (
                          <div className="text-xs text-muted-foreground">{interval.department.name}</div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums text-foreground">
                          {formatLaborDuration(interval.durationSeconds)}
                        </div>
                        <div className={`text-xs font-medium ${interval.isRunning ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                          {interval.isRunning ? 'Running' : 'Stopped'}
                        </div>
                      </div>
                    </div>

                    {interval.actions.length > 0 ? (
                      <div className="mt-2 space-y-1 rounded-md bg-muted/25 px-3 py-2">
                        {interval.actions.map((action, index) => (
                          <div key={`${action.action}:${action.createdAtMs}:${index}`} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{getActionLabel(action.action)}</span>
                            {action.actor ? ` by ${getLaborPersonLabel(action.actor, 'Console operator')}` : ''}
                            {' · '}{formatDateTime(action.createdAtMs)}
                            {action.reason?.trim() ? ` · ${action.reason.trim()}` : ''}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
