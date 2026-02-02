'use client';

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type AvailableItem = {
  id: string;
  name: string;
  description?: string | null;
  kind: 'addon' | 'checklist';
  rateType?: 'HOURLY' | 'FLAT';
  departmentName?: string | null;
};

type AvailableItemsLibraryProps = {
  title?: string;
  description?: string;
  items: AvailableItem[];
  onAddItem: (item: AvailableItem) => void;
  disabled?: boolean;
};

function groupItems(items: AvailableItem[]) {
  const grouped = new Map<string, AvailableItem[]>();
  items.forEach((item) => {
    const groupKey = item.departmentName?.trim() || 'Other';
    const group = grouped.get(groupKey) ?? [];
    group.push(item);
    grouped.set(groupKey, group);
  });
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function AvailableItemsLibrary({
  title = 'Available items',
  description = 'Drag items onto the selected part or click Add.',
  items,
  onAddItem,
  disabled,
}: AvailableItemsLibraryProps) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.name, item.description, item.departmentName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
  }, [items, query]);

  const grouped = React.useMemo(() => groupItems(filtered), [filtered]);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search items"
        className="bg-background"
      />
      <div className="space-y-3">
        {grouped.length ? (
          grouped.map(([groupName, groupItems]) => (
            <div key={groupName} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </div>
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  draggable={!disabled}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({ id: item.id, kind: item.kind })
                    );
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  className={`flex items-start justify-between gap-3 rounded border border-border/60 bg-background/80 p-3 ${
                    disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    {item.description ? (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {item.kind === 'checklist' ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          Checklist
                        </Badge>
                      ) : null}
                      {item.rateType ? (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {item.rateType === 'HOURLY' ? 'Labor' : 'Flat'}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddItem(item)}
                    disabled={disabled}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
            No items found.
          </div>
        )}
      </div>
    </div>
  );
}
