"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

type FeedPart = {
  id: string;
  partNumber: string | null;
  quantity: number | null;
  flagged: boolean;
  reasonText: string | null;
  hasOpenWork: boolean;
};

type FeedOrder = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  dueDate: string | Date | null;
  status: string;
  readyParts: FeedPart[];
  readyPartsCount: number;
};

type Props = {
  departments: Array<{ id: string; name: string; sortOrder?: number | null }>;
  initialDepartmentId: string | null;
  initialDepartmentFeed: FeedOrder[];
};

function formatDate(input?: string | Date | null) {
  if (!input) return 'No due date';
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString();
}

export function ShopFloorLayouts({ departments, initialDepartmentId, initialDepartmentFeed }: Props) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [departmentFeed, setDepartmentFeed] = useState(initialDepartmentFeed ?? []);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  const loadDepartmentFeed = useCallback(async (nextDepartmentId: string, includeCompletedValue: boolean) => {
    if (!nextDepartmentId) return;
    setDepartmentLoading(true);
    setDepartmentError(null);
    try {
      const params = new URLSearchParams({ departmentId: nextDepartmentId, includeCompleted: String(includeCompletedValue) });
      const res = await fetch(`/api/intelligence/department-feed?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || 'Failed to load queue');
      const data = await res.json();
      setDepartmentFeed(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      setDepartmentError(err?.message ?? 'Failed to load queue');
      setDepartmentFeed([]);
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  useEffect(() => {
    setDepartmentId(initialDepartmentId ?? '');
    setDepartmentFeed(initialDepartmentFeed ?? []);
  }, [initialDepartmentId, initialDepartmentFeed]);

  useEffect(() => {
    if (!departmentId) return;
    if (departmentId === initialDepartmentId && includeCompleted === false) {
      setDepartmentFeed(initialDepartmentFeed ?? []);
      return;
    }
    loadDepartmentFeed(departmentId, includeCompleted);
  }, [departmentId, includeCompleted, initialDepartmentId, initialDepartmentFeed, loadDepartmentFeed]);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {departments.map((department) => (
          <button
            key={department.id}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${departmentId === department.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}
            onClick={() => setDepartmentId(department.id)}
          >
            {department.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          id="include-completed"
          checked={includeCompleted}
          onCheckedChange={(next) => setIncludeCompleted(Boolean(next))}
        />
        <label htmlFor="include-completed">Include completed work in this department</label>
      </div>

      {departmentError ? <div className="text-sm text-destructive">{departmentError}</div> : null}
      {departmentLoading ? <div className="text-sm text-muted-foreground">Loading queue…</div> : null}

      <div className="space-y-3">
        {departmentFeed.map((order) => (
          <div key={order.orderId} className="rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <Link href={`/orders/${order.orderId}`} className="font-medium text-foreground hover:underline">
                {order.orderNumber}
              </Link>
              <div className="text-xs text-muted-foreground">Due {formatDate(order.dueDate)}</div>
            </div>
            <div className="text-xs text-muted-foreground">{order.customerName ?? 'No customer'} · {order.status}</div>
            <div className="mt-2 space-y-2">
              {order.readyParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                  <div>
                    <div>{part.partNumber || `Part ${part.id.slice(0, 6)}`}</div>
                    <div className="text-xs text-muted-foreground">Qty {part.quantity ?? 1}{!part.hasOpenWork ? ' · completed in dept' : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {part.flagged ? <Badge variant="destructive" title={part.reasonText ?? 'Rework'}>REWORK</Badge> : null}
                    <Link href={`/orders/${order.orderId}`} className="text-xs text-primary hover:underline">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!departmentLoading && !departmentFeed.length ? <div className="text-sm text-muted-foreground">No matching work in this department.</div> : null}
      </div>
    </div>
  );
}
