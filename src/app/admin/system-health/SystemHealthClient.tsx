'use client';
import * as React from 'react';
import { Button } from '@/components/ui/Button';

type Snapshot = Awaited<ReturnType<typeof import('@/modules/system-health/system-health.service').getSystemHealthSnapshot>>;
const bytes = (value: number) => `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
const duration = (seconds: number) => `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export function SystemHealthClient() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [error, setError] = React.useState('');
  const refresh = React.useCallback(async () => {
    try { const response = await fetch('/api/admin/system-health', { credentials: 'include', cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Health check failed.'); setSnapshot(data); setError(''); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Health check failed.'); }
  }, []);
  React.useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15_000); return () => window.clearInterval(timer); }, [refresh]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-semibold">Server monitor</h1><p className="text-sm text-muted-foreground">Application, host and drawing-import activity. Refreshes every 15 seconds.</p></div><Button type="button" variant="outline" onClick={() => void refresh()}>Refresh now</Button></div>
    {error ? <p role="alert" className="rounded border border-destructive/50 p-3 text-destructive">{error}</p> : null}
    {!snapshot ? <p>Checking server…</p> : <>
      <section className="grid gap-3 md:grid-cols-4">{[
        ['Application', snapshot.application.status === 'ok' ? 'Online' : snapshot.application.status],
        ['App uptime', duration(snapshot.application.uptimeSeconds)], ['Host uptime', duration(snapshot.host.uptimeSeconds)],
        ['Memory', `${bytes(snapshot.host.freeMemoryBytes)} free / ${bytes(snapshot.host.totalMemoryBytes)}`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card/60 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</section>
      <section className="rounded-xl border border-border bg-card/60 p-4"><h2 className="font-semibold">Last 24 hours</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Orders" value={snapshot.activity24Hours.ordersCreated}/><Metric label="Quotes" value={snapshot.activity24Hours.quotesCreated}/><Metric label="AI attempts" value={snapshot.activity24Hours.aiAttempts}/><Metric label="Average AI" value={`${(snapshot.activity24Hours.averageAiLatencyMs / 1000).toFixed(1)}s`}/><Metric label="AI cost" value={`$${snapshot.activity24Hours.aiCostUsd.toFixed(2)}`}/></div></section>
      <section className="rounded-xl border border-border bg-card/60 p-4"><h2 className="font-semibold">Active drawing imports ({snapshot.activeImports.length})</h2>{snapshot.activeImports.length ? <div className="mt-3 space-y-2">{snapshot.activeImports.map((job) => <div key={job.id} className="flex flex-wrap justify-between gap-2 rounded border border-border/70 p-3 text-sm"><span>{job.customerName} · {job.destination}</span><span>{job.status} · {job.stage} · updated {new Date(job.updatedAt).toLocaleTimeString()}</span></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No queued or processing imports.</p>}</section>
      <p className="text-xs text-muted-foreground">Checked {new Date(snapshot.checkedAt).toLocaleString()} · {snapshot.host.hostname} · Node {snapshot.application.nodeVersion} · process {snapshot.application.pid}</p>
    </>}
  </div>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>; }
