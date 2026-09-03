'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

export function OrderTravelerControls({ orderId }: { orderId: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm print:hidden sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Order Traveler</p>
        <p className="text-sm text-muted-foreground">
          One US Letter traveler prints for each part in this order.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to order
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print travelers
        </button>
      </div>
    </div>
  );
}
