import Link from 'next/link';
import { ArrowRight, ClipboardList, Plus } from 'lucide-react';

import NavTabs from '@/components/Admin/NavTabs';

export default function AdminOrdersPage() {
  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a customer order or open the Shop Floor to manage work already in progress.
            </p>
          </div>

          <Link
            href="/orders/new"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Make a new order
          </Link>
        </div>

        <Link
          href="/"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card/40 p-5 transition-colors hover:border-primary/50 hover:bg-card/70"
        >
          <span className="flex items-center gap-4">
            <span className="rounded-lg bg-primary/10 p-3 text-primary">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">Open active orders</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                View and manage current work on the Shop Floor.
              </span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
