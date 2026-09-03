"use client";

import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';

export type OrderChecklistEntry = {
  id: string;
  completed?: boolean | null;
  departmentId?: string | null;
  department?: { name?: string | null } | null;
  charge?: { name?: string | null } | null;
  addon?: { name?: string | null; description?: string | null } | null;
  performedBy?: { name?: string | null; email?: string | null } | null;
  meta?: { performedByLabel?: string | null } | null;
};

type OrderChecklistPanelProps = {
  entries: OrderChecklistEntry[];
  error: string | null;
  onToggle: (entry: OrderChecklistEntry, checked: boolean) => void | Promise<void>;
};

export function OrderChecklistPanel({ entries, error, onToggle }: OrderChecklistPanelProps) {
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { departmentId: string | null; departmentName: string; entries: OrderChecklistEntry[] }
    >();

    entries.forEach((entry) => {
      const departmentId = entry.departmentId ?? null;
      const departmentName =
        entry.department?.name ||
        (departmentId ? `Department ${departmentId}` : 'Unassigned Department');
      const key = departmentId ?? '__none__';
      if (!grouped.has(key)) {
        grouped.set(key, { departmentId, departmentName, entries: [] });
      }
      grouped.get(key)?.entries.push(entry);
    });

    return Array.from(grouped.values());
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ListChecks className="h-4 w-4 text-muted-foreground" /> To-do / Checklist
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {groups.length ? (
        groups.map((group) => (
          <div key={group.departmentId ?? '__none__'} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.departmentName}
            </div>
            {group.entries.map((entry) => {
              const label = entry.charge?.name ?? entry.addon?.name ?? 'Checklist item';
              const performedByLabel =
                entry.performedBy?.name ||
                entry.performedBy?.email ||
                entry.meta?.performedByLabel ||
                null;
              return (
                <label
                  key={entry.id}
                  className="order-detail-tile flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={Boolean(entry.completed)}
                      onCheckedChange={(checked) => void onToggle(entry, checked === true)}
                    />
                    <div>
                      <div className="font-medium text-foreground">{label}</div>
                      {entry.addon?.description ? (
                        <div className="text-xs text-muted-foreground">{entry.addon.description}</div>
                      ) : null}
                      {performedByLabel ? (
                        <div className="text-xs text-muted-foreground">
                          {entry.completed ? 'Performed by' : 'Last marked by'} {performedByLabel}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.completed ? 'Done' : 'Open'}</span>
                </label>
              );
            })}
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No checklist items for this part.</p>
      )}
    </div>
  );
}
