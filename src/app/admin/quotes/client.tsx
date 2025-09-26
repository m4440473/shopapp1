'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fetchJson } from '@/lib/fetchJson';

interface QuoteItem {
  id: string;
  quoteNumber: string;
  companyName: string;
  contactName?: string | null;
  status: string;
  totalCents: number;
  updatedAt: string;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
}

interface ClientProps {
  initial: { items: QuoteItem[]; nextCursor: string | null };
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  EXPIRED: 'Expired',
};

export default function Client({ initial }: ClientProps) {
  const [items, setItems] = useState<QuoteItem[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const toast = useToast();
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: 'quoteNumber',
        header: 'Quote',
        render: (_: any, row: QuoteItem) => (
          <Link href={`/admin/quotes/${row.id}`} className="font-medium text-primary hover:underline">
            {row.quoteNumber}
          </Link>
        ),
      },
      {
        key: 'companyName',
        header: 'Company',
        render: (value: string, row: QuoteItem) => (
          <div className="flex flex-col">
            <span className="font-medium">{value}</span>
            {row.customer?.name && <span className="text-xs text-muted-foreground">Customer: {row.customer.name}</span>}
          </div>
        ),
      },
      {
        key: 'contactName',
        header: 'Contact',
      },
      {
        key: 'status',
        header: 'Status',
        render: (value: string) => STATUS_LABELS[value] ?? value,
      },
      {
        key: 'totalCents',
        header: 'Total',
        render: (value: number) => formatCurrency(value),
      },
      {
        key: 'updatedAt',
        header: 'Updated',
        render: (value: string) => new Date(value).toLocaleDateString(),
      },
    ],
    []
  );

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (status) qs.set('status', status);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<{ items: QuoteItem[]; nextCursor: string | null }>(
      `/api/admin/quotes?${qs.toString()}`
    );
    setItems(cursor ? [...items, ...(data.items ?? [])] : data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
  }

  async function remove(row: QuoteItem) {
    await fetchJson(`/api/admin/quotes/${row.id}`, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== row.id));
    toast.push('Quote deleted', 'success');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by quote number, company, or contact"
          className="w-full max-w-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <Button variant="outline" onClick={() => refresh()}>
          Search
        </Button>
        <div className="flex-1" />
        <Button asChild>
          <Link href="/admin/quotes/new">New quote</Link>
        </Button>
      </div>

      <Table
        columns={columns as any}
        rows={items}
        onEdit={(row) => router.push(`/admin/quotes/${row.id}`)}
        onDelete={remove}
      />

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => refresh(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
