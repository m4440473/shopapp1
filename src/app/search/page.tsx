import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import { Search as SearchIcon } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'border-primary/40 bg-primary/10 text-primary',
  PROGRAMMING: 'border-blue-400/40 bg-blue-400/15 text-blue-200',
  SETUP: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  RUNNING: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  FINISHING: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  DONE_MACHINING: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  INSPECTION: 'border-lime-300/60 bg-lime-300/20 text-lime-100',
  SHIPPING: 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100',
  CLOSED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
};

function formatDate(input?: Date | string | null) {
  if (!input) return '—';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function buildQueryVariants(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  const title = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  const variants = new Set([trimmed, lower, upper, title]);
  return Array.from(variants).filter(Boolean);
}

type SearchPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const session = await getServerAuthSession();
  if (!session) {
    const callbackUrl = resolvedSearchParams?.q
      ? `/search?q=${encodeURIComponent(resolvedSearchParams.q)}`
      : '/search';
    redirect(buildSignInRedirectPath(callbackUrl));
  }

  const query = resolvedSearchParams?.q?.trim() ?? '';
  const hasQuery = query.length > 0;

  const results = hasQuery
    ? await prisma.order.findMany({
        where: {
          OR: (() => {
            const variants = buildQueryVariants(query);
            if (variants.length === 0) {
              return [
                { orderNumber: { contains: query } },
                { customer: { name: { contains: query } } },
                { parts: { some: { partNumber: { contains: query } } } },
              ];
            }
            const clauses: any[] = [];
            for (const value of variants) {
              clauses.push({ orderNumber: { contains: value } });
              clauses.push({ customer: { name: { contains: value } } });
              clauses.push({ parts: { some: { partNumber: { contains: value } } } });
            }
            return clauses;
          })(),
        },
        include: {
          customer: { select: { id: true, name: true } },
          assignedMachinist: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { orderNumber: 'asc' }],
        take: 60,
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Search</p>
          <h1 className="text-4xl font-semibold text-foreground">Order lookup results</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Search across order numbers, customers, and part numbers to jump directly into work orders.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
          <SearchIcon className="h-4 w-4" />
          <span>{hasQuery ? query : 'Enter a term above to search orders'}</span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/80 backdrop-blur">
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {hasQuery
              ? `${results.length} ${results.length === 1 ? 'match' : 'matches'} for “${query}”.`
              : 'Type in the search bar to find orders by number, customer, or part.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {hasQuery ? (
            results.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="w-[140px]">Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Machinist</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((order) => (
                      <TableRow key={order.id} className="border-border/60">
                        <TableCell className="font-semibold text-primary">
                          <Link href={`/orders/${order.id}`} className="hover:underline">
                            #{order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.customer?.name ?? 'Unknown customer'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide ${
                              STATUS_STYLES[order.status] ?? 'border-border/60 bg-secondary/40 text-foreground'
                            }`}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(order.dueDate)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            View order
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No orders matched that search. Try another order number, customer, or part.
              </div>
            )
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Start typing in the search bar to see matching orders.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
