"use client";

import { Timer } from 'lucide-react';

import { PartLaborHistory } from '@/modules/time/PartLaborHistory';

export function OrderActivityPanel({
  events,
  laborEntries,
  loading,
}: {
  events: any[];
  laborEntries: any[];
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <PartLaborHistory entries={laborEntries} title="Timer history" />
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Timer className="h-4 w-4 text-muted-foreground" /> Part log
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading log…</div>
      ) : events.length ? (
        events.map((event) => {
          const actorLabel = event.user?.name || event.user?.email || 'System';
          const performerLabel =
            event.meta?.performedByLabel ||
            event.meta?.performerLabel ||
            event.meta?.performedByName ||
            null;
          const actorDiffers = performerLabel && performerLabel !== actorLabel;

          return (
            <div key={event.id} className="order-detail-tile rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{actorLabel}</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 font-medium text-foreground">{event.message}</div>
              <div className="text-xs text-muted-foreground">
                {event.type}
                {actorDiffers ? ` · performed by ${performerLabel}` : ''}
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">No events yet for this part.</p>
      )}
    </div>
  );
}
