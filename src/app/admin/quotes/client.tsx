'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';

import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_OPTIONS, businessNameFromCode } from '@/lib/businesses';
import { fetchJson } from '@/lib/fetchJson';
import QuoteWorkflowControls from './QuoteWorkflowControls';
import { mergeQuoteMetadata, type QuoteMetadata } from '@/lib/quote-metadata';
import AdminPricingGate from '@/components/Admin/AdminPricingGate';
import { canAccessAdmin } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-current-user';

interface QuoteItem {
  id: string;
  quoteNumber: string;
  business: string;
  companyName: string;
  contactName?: string | null;
  status: string;
  totalCents: number;
  updatedAt: string;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  metadata?: QuoteMetadata | null;
}

interface ClientProps {
  initial: { items: QuoteItem[]; nextCursor: string | null };
  initialRole?: string | null;
  initialAdmin?: boolean;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  EXPIRED: 'Expired',
};

export default function Client({ initial, initialRole, initialAdmin }: ClientProps) {
  const [items, setItems] = useState<QuoteItem[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const toast = useToast();
  const router = useRouter();
  const user = useCurrentUser();
  const isAdmin = canAccessAdmin(user ?? undefined);

  const updateRowMetadata = useCallback(
    (id: string, metadata: QuoteMetadata) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                metadata,
              }
            : item,
        ),
      );
    },
    [],
  );

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
        key: 'business',
        header: 'Business',
        render: (value: string) => {
          const option = BUSINESS_OPTIONS.find((item) => item.code === value);
          if (!option) {
            return <Badge variant="outline">{value}</Badge>;
          }
          return (
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit font-mono text-xs">
                {option.prefix}
              </Badge>
              <span className="text-xs text-muted-foreground">{option.name}</span>
            </div>
          );
        },
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
        render: (value: number) => (
              <AdminPricingGate
                initialRole={initialRole}
                initialAdmin={initialAdmin}
                admin={<span className="font-medium">{formatCurrency(value)}</span>}
                fallback={<span className="text-muted-foreground">Restricted</span>}
              />
        ),
      },
      {
        key: 'updatedAt',
        header: 'Updated',
        render: (value: string) => new Date(value).toLocaleDateString(),
      },
      {
        key: 'workflow',
        header: 'Workflow',
        render: (_: any, row: QuoteItem) => {
          const metadata = mergeQuoteMetadata(row.metadata);
          const businessName = businessNameFromCode(row.business);
          return (
            <QuoteWorkflowControls
              layout="table"
              quoteId={row.id}
              quoteNumber={row.quoteNumber}
              businessName={businessName}
              companyName={row.companyName}
              customerName={row.customer?.name ?? row.companyName}
              customerId={row.customer?.id ?? null}
              approval={metadata.approval!}
              conversion={metadata.conversion!}
              onMetadataUpdate={(next) => updateRowMetadata(row.id, next)}
              onConverted={(result) => {
                updateRowMetadata(row.id, result.metadata);
                toast.push(`Order ${result.orderNumber} created`, 'success');
              }}
            />
          );
        },
      },
    ],
    [initialAdmin, initialRole, toast, updateRowMetadata]
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] border border-border bg-background">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refresh()}>
          Search
        </Button>
        <div className="flex-1" />
        {isAdmin && (
          <Button asChild>
            <Link href="/admin/quotes/new">New quote</Link>
          </Button>
        )}
      </div>

      <Table
        columns={columns as any}
        rows={items}
        onEdit={(row) => router.push(`/admin/quotes/${row.id}`)}
        onDelete={remove}
        actionsEnabled={isAdmin}
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
