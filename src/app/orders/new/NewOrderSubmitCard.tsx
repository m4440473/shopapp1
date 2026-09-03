'use client';

import Link from 'next/link';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardFooter } from '@/components/ui/Card';

export function NewOrderSubmitCard({
  submitting,
  disabled,
  message,
  createdOrderId,
  onViewOrder,
  onPrintOrder,
  onBackToOrders,
}: {
  submitting: boolean;
  disabled: boolean;
  message: string;
  createdOrderId: string | null;
  onViewOrder: () => void;
  onPrintOrder: () => void;
  onBackToOrders: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Orders auto-number starting at 1001</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={submitting || disabled} className="rounded-full bg-primary px-6 text-primary-foreground shadow-lg shadow-primary/30">{submitting ? 'Submitting…' : 'Create order'}</Button>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link href="/">Cancel</Link></Button>
        </div>
      </CardFooter>
      {message || createdOrderId ? (
        <div className="px-6 pb-6">
          {message ? <p className={`text-sm ${createdOrderId ? 'text-primary' : 'text-destructive'}`}>{message}</p> : null}
          {createdOrderId ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="button" onClick={onViewOrder} className="rounded-full px-6">View order</Button>
              <Button type="button" variant="outline" onClick={onPrintOrder} className="rounded-full border-border/60 bg-background/80"><Printer className="mr-2 h-4 w-4" /> Print order</Button>
              <Button type="button" variant="outline" onClick={onBackToOrders} className="rounded-full border-border/60 bg-background/80">Back to orders</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
