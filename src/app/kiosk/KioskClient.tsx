"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock, PauseCircle, Play, Search, Square, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatDuration(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export default function KioskClient() {
  const [session, setSession] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [conflict, setConflict] = useState<any | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const selectedPart = useMemo(() => parts.find((part) => part.id === selectedPartId) ?? null, [parts, selectedPartId]);

  async function loadSession() {
    setLoading(true);
    try {
      const res = await fetch('/api/kiosk/session', { credentials: 'include' });
      if (!res.ok) {
        setSession(null);
        setParts([]);
        return;
      }
      const data = await res.json();
      setSession(data);
      setDepartmentId(data.defaultDepartmentId ?? '');
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  const loadParts = useCallback(async (nextDepartmentId: string, nextQuery: string) => {
    if (!session || !nextDepartmentId) {
      setParts([]);
      return;
    }
    const params = new URLSearchParams({ departmentId: nextDepartmentId, q: nextQuery });
    const res = await fetch(`/api/kiosk/parts?${params.toString()}`, { credentials: 'include' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(typeof data?.error === 'string' ? data.error : 'Failed to load parts.');
      setParts([]);
      return;
    }
    setParts(Array.isArray(data?.items) ? data.items : []);
  }, [session]);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (!session || !departmentId) return;
    void loadParts(departmentId, query);
  }, [session, departmentId, query, loadParts]);

  useEffect(() => {
    const timer = session?.activeTimer ? window.setInterval(() => setNowMs(Date.now()), 1000) : null;
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [session?.activeTimer]);

  async function handleUnlock() {
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch('/api/kiosk/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to unlock kiosk.');
        return;
      }
      setSession(data);
      setDepartmentId(data.defaultDepartmentId ?? '');
      setPin('');
      setConflict(null);
    } catch {
      setError('Failed to unlock kiosk.');
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLock() {
    setActing(true);
    await fetch('/api/kiosk/lock', { method: 'POST', credentials: 'include' });
    setSession(null);
    setParts([]);
    setSelectedPartId('');
    setConflict(null);
    setActing(false);
  }

  async function handleStart() {
    if (!selectedPart || !departmentId) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch('/api/kiosk/timer/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedPart.orderId,
          partId: selectedPart.id,
          departmentId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const payload = data?.error;
        if (res.status === 409 && payload?.requiredAction === 'switch_confirmation') {
          setConflict({ ...payload, target: selectedPart, departmentId });
          return;
        }
        setError(typeof payload === 'string' ? payload : typeof data?.error === 'string' ? data.error : 'Failed to start timer.');
        return;
      }
      await loadSession();
      await loadParts(departmentId, query);
    } catch {
      setError('Failed to start timer.');
    } finally {
      setActing(false);
    }
  }

  async function handleAction(action: 'pause' | 'finish') {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/kiosk/timer/${action}`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : `Failed to ${action} timer.`);
        return;
      }
      await loadSession();
      await loadParts(departmentId, query);
    } catch {
      setError(`Failed to ${action} timer.`);
    } finally {
      setActing(false);
    }
  }

  async function handleSwitch(stopMode: 'pause' | 'finish') {
    if (!conflict?.target) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch('/api/kiosk/timer/switch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: conflict.target.orderId,
          partId: conflict.target.id,
          departmentId: conflict.departmentId,
          stopMode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to switch timer.');
        return;
      }
      setConflict(null);
      await loadSession();
      await loadParts(departmentId, query);
    } catch {
      setError('Failed to switch timer.');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading kiosk…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">Shop Kiosk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                Enter your PIN to punch time. Use the normal order page to review notes, files, and checklist items.
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-pin">PIN</Label>
                <Input id="kiosk-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
              {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
              <Button className="w-full" disabled={unlocking || pin.trim().length < 4} onClick={() => void handleUnlock()}>
                {unlocking ? 'Unlocking…' : 'Unlock kiosk'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const activeTimer = session.activeTimer;
  const activeElapsed = activeTimer?.startedAt
    ? Math.max(0, Math.floor((nowMs - new Date(activeTimer.startedAt).getTime()) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{session.worker.name || session.worker.email}</div>
                  <div className="text-xs text-muted-foreground">{session.worker.primaryDepartment?.name || 'No default department'}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={acting} onClick={() => void handleLock()}>
                <Lock className="mr-2 h-4 w-4" />
                Lock
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose department" />
                </SelectTrigger>
                <SelectContent>
                  {(Array.isArray(session.departments) ? session.departments : []).map((department: any) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kiosk-search">Part search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="kiosk-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order, customer, or part" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
              {parts.length ? parts.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => setSelectedPartId(part.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedPartId === part.id ? 'border-primary bg-primary/10' : 'border-border/60 bg-muted/10 hover:bg-muted/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{part.partNumber || 'Unnamed part'}</div>
                    <div className="text-xs text-muted-foreground">{part.order?.orderNumber}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {part.order?.customer?.name || 'No customer'} • Qty {part.quantity ?? 0}
                  </div>
                </button>
              )) : (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                  No open parts found for this department.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timing Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTimer ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-sm font-medium text-foreground">
                  Active: {activeTimer.order?.orderNumber || 'Order'} / {activeTimer.part?.partNumber || activeTimer.partId || 'Part'}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {activeTimer.departmentName || activeTimer.departmentId || 'No department'} • {formatDuration(activeElapsed)}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" className="justify-center gap-2" disabled={acting} onClick={() => void handleAction('pause')}>
                    <PauseCircle className="h-5 w-5" />
                    Pause
                  </Button>
                  <Button size="lg" className="justify-center gap-2" disabled={acting} onClick={() => void handleAction('finish')}>
                    <Square className="h-5 w-5" />
                    Stop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                No active timer. Select a part and start work.
              </div>
            )}

            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected part</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{selectedPart?.partNumber || 'No part selected'}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {selectedPart ? `${selectedPart.order?.orderNumber || 'Order'} • ${selectedPart.order?.customer?.name || 'No customer'}` : 'Pick a part on the left.'}
              </div>
              {selectedPart ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button size="lg" className="gap-2" disabled={acting || !departmentId} onClick={() => void handleStart()}>
                    <Play className="h-5 w-5" />
                    Start timer
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href={`/orders/${selectedPart.orderId}?part=${selectedPart.id}`}>Open order details</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            {conflict ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="text-sm font-medium text-foreground">
                  Timer already running on {conflict.activeOrder?.orderNumber || 'another order'}
                  {conflict.activePart?.partNumber ? ` / ${conflict.activePart.partNumber}` : ''}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {conflict.activeEntry?.departmentName || conflict.activeEntry?.departmentId || 'Unknown department'} • {formatDuration(conflict.elapsedSeconds ?? 0)}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="outline" disabled={acting} onClick={() => void handleSwitch('pause')}>Pause & switch</Button>
                  <Button disabled={acting} onClick={() => void handleSwitch('finish')}>Stop & switch</Button>
                  <Button variant="ghost" disabled={acting} onClick={() => setConflict(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}

            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
