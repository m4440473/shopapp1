"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Radio } from 'lucide-react';

export type RunningWorkerSummary = {
  entryId: string;
  workerId: string;
  workerName: string;
  orderId: string;
  orderNumber: string;
  partId: string | null;
  partNumber: string | null;
  partName?: string | null;
  departmentName?: string | null;
  startedAt: Date | string;
};

export function buildOrderPartHref(worker: Pick<RunningWorkerSummary, 'orderId' | 'partId'>) {
  const orderHref = `/orders/${encodeURIComponent(worker.orderId)}`;
  return worker.partId ? `${orderHref}?part=${encodeURIComponent(worker.partId)}` : orderHref;
}

export function formatRunningDuration(startedAt: Date | string, nowMs: number) {
  const startedMs = new Date(startedAt).getTime();
  const elapsedSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0;
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function RunningWorkersStrip({ workers }: { workers: RunningWorkerSummary[] }) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const sortedWorkers = useMemo(
    () => [...workers].sort((a, b) => a.workerName.localeCompare(b.workerName, undefined, { sensitivity: 'base' })),
    [workers],
  );

  useEffect(() => {
    setNowMs(Date.now());
    if (!workers.length) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [workers.length]);

  return (
    <section
      aria-labelledby="running-workers-heading"
      className="overflow-hidden rounded-xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-card to-primary/10 shadow-lg shadow-emerald-950/10"
    >
      <div className="flex flex-col gap-2 border-b border-emerald-500/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4" aria-hidden="true">
            {sortedWorkers.length ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /> : null}
            <span className={`relative inline-flex h-4 w-4 rounded-full ${sortedWorkers.length ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Live shop activity</p>
            <h2 id="running-workers-heading" className="text-2xl font-bold tracking-tight text-foreground">
              Working now
            </h2>
          </div>
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          {sortedWorkers.length === 1 ? '1 employee running' : `${sortedWorkers.length} employees running`}
        </div>
      </div>

      {sortedWorkers.length ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {sortedWorkers.map((worker) => {
            const partNumber = worker.partNumber?.trim() || 'Part not recorded';
            const partLabel = worker.partName?.trim()
              ? `${partNumber} · ${worker.partName.trim()}`
              : partNumber;
            return (
              <Link
                key={worker.entryId}
                href={buildOrderPartHref(worker)}
                className="group grid min-h-32 grid-cols-[1fr_auto] gap-4 rounded-xl border border-emerald-500/30 bg-background/85 p-5 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-500/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={`Open ${worker.workerName}'s running work on ${partNumber}, order ${worker.orderNumber}`}
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-2xl font-bold text-foreground">{worker.workerName}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      <Radio className="h-3.5 w-3.5" aria-hidden="true" /> Running
                    </span>
                  </div>
                  <p className="truncate text-lg font-semibold text-primary">#{worker.orderNumber} · {partLabel}</p>
                  <p className="truncate text-sm text-muted-foreground">{worker.departmentName || 'Department not set'}</p>
                </div>
                <div className="flex flex-col items-end justify-between gap-3">
                  <ArrowUpRight className="h-6 w-6 text-muted-foreground transition group-hover:text-emerald-300" aria-hidden="true" />
                  <span className="inline-flex items-center gap-2 font-mono text-xl font-bold tabular-nums text-emerald-300" aria-hidden="true">
                    <Clock3 className="h-5 w-5" />
                    {nowMs === null ? '--:--:--' : formatRunningDuration(worker.startedAt, nowMs)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-lg font-semibold text-foreground">No timers are running.</p>
          <p className="mt-1 text-sm text-muted-foreground">Started jobs will appear here.</p>
        </div>
      )}
    </section>
  );
}
