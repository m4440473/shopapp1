'use client';

import React from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { AvailableItem } from '@/components/AvailableItemsLibrary';

export type AssignedItem = {
  key: string;
  itemId: string;
  units: string;
  notes: string;
};

type AssignedItemsPanelProps = {
  title?: string;
  description?: string;
  assignments: AssignedItem[];
  itemsById: Map<string, AvailableItem>;
  onAddItem: (itemId: string) => void;
  onUpdateAssignment: (key: string, patch: Partial<AssignedItem>) => void;
  onRemoveAssignment: (key: string) => void;
  onMoveAssignment?: (key: string, direction: 'up' | 'down') => void;
  renderMeta?: (assignment: AssignedItem, item?: AvailableItem) => React.ReactNode;
  disabled?: boolean;
};

const parseDroppedItem = (event: React.DragEvent<HTMLDivElement>) => {
  const payload = event.dataTransfer.getData('application/json');
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed?.id === 'string') return parsed.id;
  } catch {
    return null;
  }
  return null;
};

const getUnitsLabel = (item?: AvailableItem) => {
  if (item?.rateType === 'HOURLY') return 'Hours';
  if (item?.rateType === 'FLAT') return 'Quantity';
  return 'Units';
};

export function AssignedItemsPanel({
  title = 'Assigned items',
  description = 'Drop items here or use the Add button.',
  assignments,
  itemsById,
  onAddItem,
  onUpdateAssignment,
  onRemoveAssignment,
  onMoveAssignment,
  renderMeta,
  disabled,
}: AssignedItemsPanelProps) {
  const [dragging, setDragging] = React.useState(false);

  return (
    <div
      className={`space-y-3 rounded-lg border border-border/60 bg-card/60 p-4 ${
        dragging ? 'ring-2 ring-primary/50' : ''
      }`}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        const itemId = parseDroppedItem(event);
        if (itemId) onAddItem(itemId);
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {assignments.length ? (
        <div className="space-y-3">
          {assignments.map((assignment, index) => {
            const item = itemsById.get(assignment.itemId);
            return (
              <div key={assignment.key} className="rounded border border-border/60 bg-background/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item?.name ?? 'Unknown item'}</div>
                    {item?.description ? (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onMoveAssignment ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveAssignment(assignment.key, 'up')}
                          disabled={disabled || index === 0}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveAssignment(assignment.key, 'down')}
                          disabled={disabled || index === assignments.length - 1}
                        >
                          Down
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveAssignment(assignment.key)}
                      disabled={disabled}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground">{getUnitsLabel(item)}</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={assignment.units}
                      onChange={(event) => onUpdateAssignment(assignment.key, { units: event.target.value })}
                      disabled={disabled}
                    />
                  </div>
                  <div className="md:col-span-2">{renderMeta ? renderMeta(assignment, item) : null}</div>
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea
                    value={assignment.notes}
                    onChange={(event) => onUpdateAssignment(assignment.key, { notes: event.target.value })}
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
          {disabled ? 'Assignments are read-only.' : 'Drop items here to add them to this part.'}
        </div>
      )}
    </div>
  );
}
