'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  LayoutGrid,
  LayoutList,
  Search,
  X,
} from 'lucide-react';

import { BUSINESS_OPTIONS } from '@/lib/businesses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  filterAndSortCustomers,
  type CustomerActivityFilter,
  type CustomerDashboardRecord,
  type CustomerSortDirection,
  type CustomerSortField,
} from './customer-dashboard.shared';

const SORT_OPTIONS: Array<[CustomerSortField, string]> = [
  ['name', 'Customer name'],
  ['recentWork', 'Most recent work'],
  ['orders', 'Total orders'],
  ['activeOrders', 'Active orders'],
  ['parts', 'Part quantity'],
  ['frequency', 'Order frequency'],
  ['labor', 'Labor hours'],
];

function formatLabor(seconds: number) {
  if (seconds <= 0) return '—';
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(seconds / 60))}m`;
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: hours < 10 ? 1 : 0 })}h`;
}

function formatFrequency(value: number) {
  if (value <= 0) return '—';
  if (value < 0.1) return '<0.1/mo';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}/mo`;
}

function formatLastWork(value: string | null) {
  if (!value) return 'No work yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No work yet';
  return formatDistanceToNow(date, { addSuffix: true });
}

function BusinessBadges({ customer }: { customer: CustomerDashboardRecord }) {
  if (!customer.businessCodes.length) {
    return <span className="text-xs text-muted-foreground">No business assigned</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {customer.businessNames.map((name, index) => (
        <Badge key={`${customer.businessCodes[index]}-${name}`} variant="outline" className="border-primary/25 bg-primary/5 text-[0.65rem] text-primary/90">
          {name}
        </Badge>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function CustomerDashboard({ customers }: { customers: CustomerDashboardRecord[] }) {
  const [search, setSearch] = useState('');
  const [business, setBusiness] = useState('all');
  const [activity, setActivity] = useState<CustomerActivityFilter>('all');
  const [sortField, setSortField] = useState<CustomerSortField>('recentWork');
  const [sortDirection, setSortDirection] = useState<CustomerSortDirection>('desc');
  const [view, setView] = useState<'tiles' | 'list'>('tiles');

  const visibleCustomers = useMemo(() => filterAndSortCustomers(customers, {
    search,
    business,
    activity,
    sortField,
    sortDirection,
  }), [activity, business, customers, search, sortDirection, sortField]);

  const hasFilters = Boolean(search.trim() || business !== 'all' || activity !== 'all');
  const activeCustomerCount = visibleCustomers.filter((customer) => customer.activeOrders > 0).length;

  function clearFilters() {
    setSearch('');
    setBusiness('all');
    setActivity('all');
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-wrap items-end gap-2">
            <div className="min-w-[15rem] flex-1 space-y-1 sm:max-w-sm">
              <Label htmlFor="customer-search" className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="customer-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, contact, phone, city…"
                  className="h-8 border-white/10 bg-background/35 pl-9 pr-8 text-xs"
                />
                {search ? (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear customer search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Business</Label>
              <Select value={business} onValueChange={setBusiness}>
                <SelectTrigger aria-label="Customer business filter" className="h-8 w-40 border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All businesses</SelectItem>
                  {BUSINESS_OPTIONS.map((option) => <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Activity</Label>
              <Select value={activity} onValueChange={(value) => setActivity(value as CustomerActivityFilter)}>
                <SelectTrigger aria-label="Customer activity filter" className="h-8 w-36 border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  <SelectItem value="active">Active work</SelectItem>
                  <SelectItem value="recent">Worked in 90 days</SelectItem>
                  <SelectItem value="inactive">No active work</SelectItem>
                  <SelectItem value="never">No orders yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Sort</Label>
              <Select value={sortField} onValueChange={(value) => setSortField(value as CustomerSortField)}>
                <SelectTrigger aria-label="Customer sort field" className="h-8 w-40 border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Direction</Label>
              <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as CustomerSortDirection)}>
                <SelectTrigger aria-label="Customer sort direction" className="h-8 w-32 border-white/10 bg-background/35 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="asc">Ascending</SelectItem><SelectItem value="desc">Descending</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">View</Label>
              <div className="flex h-8 overflow-hidden rounded-md border border-white/10 bg-background/35" role="group" aria-label="Customer view">
                <Button type="button" variant="ghost" size="sm" aria-pressed={view === 'tiles'} onClick={() => setView('tiles')} className={`h-8 rounded-none border-r border-white/10 px-3 text-xs ${view === 'tiles' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}>
                  <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Tiles
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`h-8 rounded-none px-3 text-xs ${view === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}>
                  <LayoutList className="mr-1.5 h-3.5 w-3.5" /> List
                </Button>
              </div>
            </div>
          </div>
          <p className="pb-1 text-[0.7rem] text-muted-foreground">
            {visibleCustomers.length} shown · {activeCustomerCount} with active work
          </p>
        </div>
      </div>

      {visibleCustomers.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/5">
          <CardHeader className="items-center text-center">
            <CardTitle>No customers match</CardTitle>
            <CardDescription>Try a different search, business, or activity filter.</CardDescription>
            {hasFilters ? <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : null}
          </CardHeader>
        </Card>
      ) : view === 'tiles' ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleCustomers.map((customer) => (
            <Link key={customer.id} href={`/customers/${customer.id}`} className="group h-full">
              <div className="shop-glass flex h-full flex-col gap-3 rounded-lg border p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/25">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-primary group-hover:underline">{customer.name}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {customer.primaryContact ? `${customer.primaryContact}${customer.contactCount > 1 ? ` · ${customer.contactCount} contacts` : ''}` : 'No contact on file'}
                    </p>
                  </div>
                  <Badge variant="outline" className={customer.activeOrders ? 'shrink-0 rounded-full border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'shrink-0 rounded-full text-muted-foreground'}>
                    {customer.activeOrders ? `${customer.activeOrders} active` : 'No active work'}
                  </Badge>
                </div>
                <BusinessBadges customer={customer} />
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <Metric label="Orders" value={customer.totalOrders} />
                  <Metric label="Part quantity" value={customer.partQuantity} />
                  <Metric label="Labor" value={formatLabor(customer.laborSeconds)} />
                  <Metric label="Frequency" value={formatFrequency(customer.orderFrequencyPerMonth)} />
                  <Metric label="Contacts" value={customer.contactCount} />
                  <Metric label="Last work" value={formatLastWork(customer.lastWorkAt)} />
                </div>
                <p className="mt-auto text-xs uppercase tracking-[0.25em] text-muted-foreground transition group-hover:text-primary">View customer ↗</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>
          <div className="space-y-2 md:hidden">
            {visibleCustomers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} className="block">
                <Card className="border-white/10 bg-card/55 p-3 transition hover:border-primary/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{customer.primaryContact || 'No contact on file'}</p>
                    </div>
                    <Badge className={customer.activeOrders ? 'shrink-0 bg-emerald-500/10 text-emerald-200' : 'shrink-0 bg-white/5 text-muted-foreground'}>
                      {customer.activeOrders} active
                    </Badge>
                  </div>
                  <div className="mt-2"><BusinessBadges customer={customer} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[0.6rem] uppercase text-muted-foreground">Orders</p><p className="text-sm font-semibold">{customer.totalOrders}</p></div>
                    <div><p className="text-[0.6rem] uppercase text-muted-foreground">Part qty</p><p className="text-sm font-semibold">{customer.partQuantity}</p></div>
                    <div><p className="text-[0.6rem] uppercase text-muted-foreground">Labor</p><p className="text-sm font-semibold">{formatLabor(customer.laborSeconds)}</p></div>
                    <div><p className="text-[0.6rem] uppercase text-muted-foreground">Frequency</p><p className="text-sm font-semibold">{formatFrequency(customer.orderFrequencyPerMonth)}</p></div>
                    <div className="col-span-2"><p className="text-[0.6rem] uppercase text-muted-foreground">Last work</p><p className="truncate text-sm font-semibold">{formatLastWork(customer.lastWorkAt)}</p></div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Card className="hidden overflow-hidden border-white/10 bg-card/55 md:block">
            <Table>
            <TableHeader className="bg-background/45">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-56">Customer</TableHead>
                <TableHead className="min-w-44">Business</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Part qty</TableHead>
                <TableHead className="text-right">Frequency</TableHead>
                <TableHead className="text-right">Labor</TableHead>
                <TableHead className="min-w-36 text-right">Last work</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCustomers.map((customer) => (
                <TableRow key={customer.id} className="group border-white/10 hover:bg-primary/5">
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="block font-semibold text-foreground group-hover:text-primary">
                      {customer.name}
                      <span className="mt-0.5 block max-w-56 truncate text-xs font-normal text-muted-foreground">
                        {customer.primaryContact || 'No contact on file'}{customer.contactCount > 1 ? ` · ${customer.contactCount} contacts` : ''}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell><BusinessBadges customer={customer} /></TableCell>
                  <TableCell className="text-right font-medium">{customer.activeOrders}</TableCell>
                  <TableCell className="text-right">{customer.totalOrders}</TableCell>
                  <TableCell className="text-right">{customer.partQuantity}</TableCell>
                  <TableCell className="text-right">{formatFrequency(customer.orderFrequencyPerMonth)}</TableCell>
                  <TableCell className="text-right">{formatLabor(customer.laborSeconds)}</TableCell>
                  <TableCell className="text-right text-muted-foreground" title={customer.lastWorkAt ? new Date(customer.lastWorkAt).toLocaleString() : undefined}>{formatLastWork(customer.lastWorkAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
