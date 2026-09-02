'use client';

import React from 'react';
import { Check, History, Search } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mapCustomerPartDetailToReusableDraft } from '@/modules/customer-parts/customer-part-draft';
import type {
  CustomerPartHistoryDetail,
  CustomerPartHistorySummary,
  CustomerPartReusableDraft,
} from '@/modules/customer-parts/customer-parts.types';

export type CustomerPartPickerProps = {
  customerId: string;
  business?: string;
  onAddParts: (parts: CustomerPartReusableDraft[]) => void;
  disabled?: boolean;
};

export function customerPartHistoryUrl(input: { customerId: string; business?: string; q?: string }) {
  const params = new URLSearchParams({ take: '40' });
  if (input.q?.trim()) params.set('q', input.q.trim());
  return `/api/admin/customers/${encodeURIComponent(input.customerId || 'all')}/part-history?${params.toString()}`;
}

function detailUrl(customerId: string, sourcePartId: string) {
  return `/api/admin/customers/${encodeURIComponent(customerId || 'all')}/part-history/${encodeURIComponent(sourcePartId)}`;
}

function createDraftKey() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
}

export function CustomerPartPicker({ customerId, business, onAddParts, disabled = false }: CustomerPartPickerProps) {
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<CustomerPartHistorySummary[]>([]);
  const [selectedGroups, setSelectedGroups] = React.useState<Set<string>>(() => new Set());
  const [selectedVersions, setSelectedVersions] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listAbortRef = React.useRef<AbortController | null>(null);
  const detailAbortRef = React.useRef<AbortController | null>(null);
  const activeCustomerRef = React.useRef(customerId);

  React.useEffect(() => {
    activeCustomerRef.current = customerId;
    listAbortRef.current?.abort();
    detailAbortRef.current?.abort();
    setItems([]);
    setSelectedGroups(new Set());
    setSelectedVersions({});
    setError(null);
    const controller = new AbortController();
    listAbortRef.current = controller;
    const requestedCustomerId = customerId;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(customerPartHistoryUrl({ customerId, business, q: query }), {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Could not load customer parts.');
        if (controller.signal.aborted || activeCustomerRef.current !== requestedCustomerId) return;
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        setItems(nextItems);
        setSelectedVersions(Object.fromEntries(nextItems.map((item: CustomerPartHistorySummary) => [item.groupKey, item.latest.sourcePartId])));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(loadError instanceof Error ? loadError.message : 'Could not load customer parts.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 225);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [business, customerId, query]);

  function toggleGroup(groupKey: string) {
    setSelectedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  async function addSelected() {
    const sourcePartIds = items
      .filter((item) => selectedGroups.has(item.groupKey))
      .map((item) => selectedVersions[item.groupKey] ?? item.latest.sourcePartId);
    if (!sourcePartIds.length) return;
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const requestedCustomerId = customerId;
    setAdding(true);
    setError(null);
    try {
      const details = await Promise.all(sourcePartIds.map(async (sourcePartId) => {
        const response = await fetch(detailUrl(customerId, sourcePartId), {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Could not load a selected part.');
        return data.item as CustomerPartHistoryDetail;
      }));
      if (controller.signal.aborted || activeCustomerRef.current !== requestedCustomerId) return;
      onAddParts(details.map((detail) => mapCustomerPartDetailToReusableDraft(detail, createDraftKey)));
      setSelectedGroups(new Set());
    } catch (addError) {
      if (!controller.signal.aborted) setError(addError instanceof Error ? addError.message : 'Could not add selected parts.');
    } finally {
      if (!controller.signal.aborted) setAdding(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/70 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5" /> Choose preexisting parts</h3>
        <p className="mt-1 text-sm text-muted-foreground">Search every saved part across all customers and businesses. Quantity, purchasing status, pricing, and assignments start fresh.</p>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search customer part history" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search part number, name, material, or source order" className="pl-9" disabled={disabled} />
      </label>
      {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading customer parts…</p> : null}
      {!loading && !items.length && !error ? <p className="text-sm text-muted-foreground">No matching historical parts were found.</p> : null}
      <div className="space-y-3">
        {items.map((item) => {
          const selected = selectedGroups.has(item.groupKey);
          const selectedVersionId = selectedVersions[item.groupKey] ?? item.latest.sourcePartId;
          const selectedVersion = item.versions.find((version) => version.sourcePartId === selectedVersionId) ?? item.latest;
          return (
            <div key={item.groupKey} className={`rounded-lg border p-3 ${selected ? 'border-primary bg-primary/5' : 'border-border/60'}`}>
              <div className="flex items-start gap-3">
                <button type="button" role="checkbox" aria-checked={selected} aria-label={`Select ${item.partNumber}`} onClick={() => toggleGroup(item.groupKey)} disabled={disabled || adding} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.partNumber}{item.partName ? ` — ${item.partName}` : ''}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.materialName ?? 'Material not recorded'} · {item.versionCount} historical {item.versionCount === 1 ? 'version' : 'versions'}{item.hasConflictingVersions ? ' · details differ; review the source version' : ''}</p>
                  {item.versions.length > 1 ? (
                    <label className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      Source version
                      <select value={selectedVersionId} onChange={(event) => setSelectedVersions((current) => ({ ...current, [item.groupKey]: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" disabled={disabled || adding}>
                        {item.versions.map((version) => <option key={version.sourcePartId} value={version.sourcePartId}>{version.sourceCustomerName} · Order {version.sourceOrderNumber} · {formatDate(version.receivedAt)} · {version.business} · {version.hasDrawing ? 'drawing saved' : 'no drawing'}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">Using {selectedVersion.sourceCustomerName} · order {selectedVersion.sourceOrderNumber} · {selectedVersion.business} from {formatDate(selectedVersion.receivedAt)}.</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={() => void addSelected()} disabled={disabled || adding || selectedGroups.size === 0}>{adding ? 'Adding parts…' : `Add selected (${selectedGroups.size})`}</Button>
      </div>
    </div>
  );
}
