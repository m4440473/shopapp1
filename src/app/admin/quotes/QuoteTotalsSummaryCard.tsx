'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

type QuoteTotalsSummaryCardProps = {
  basePriceCents: number;
  vendorTotalsCents: number;
  partPricingTotalCents: number;
  customAmountsTotalCents: number;
  totalCents: number;
  loading: boolean;
  onCancel: () => void;
};

export function QuoteTotalsSummaryCard({
  basePriceCents,
  vendorTotalsCents,
  partPricingTotalCents,
  customAmountsTotalCents,
  totalCents,
  loading,
  onCancel,
}: QuoteTotalsSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Totals update automatically as you edit the quote.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {basePriceCents > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span>Legacy quote-level fabrication fee</span>
            <span className="font-medium">{formatCurrency(basePriceCents)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm">
          <span>Other purchased items / outside services</span>
          <span className="font-medium">{formatCurrency(vendorTotalsCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Final part prices (includes part material)</span>
          <span className="font-medium">{formatCurrency(partPricingTotalCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Custom amounts</span>
          <span className="font-medium">{formatCurrency(customAmountsTotalCents)}</span>
        </div>
        <div className="border-t border-border/60 pt-3 text-sm font-semibold">
          <div className="flex items-center justify-between">
            <span>Total estimate</span>
            <span className="text-lg text-primary">{formatCurrency(totalCents)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Work-step rates and internal costs remain visible only to admins.</p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save quote and review'}</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
