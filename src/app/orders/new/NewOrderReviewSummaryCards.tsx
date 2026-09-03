'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { normalizeOrderQuantityInput } from '@/modules/orders/order-input';
import { calculatePartLotTotal, type PartPricingMode } from '@/modules/pricing/part-pricing';

type ReviewPart = {
  key: string;
  partNumber: string;
  partName: string;
  quantity: string;
  attachments: unknown[];
};

type PartPricing = { partKey: string; price: string; pricingMode: PartPricingMode };

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

function centsFromInput(value: string) {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function NewOrderReviewSummaryCards({
  parts,
  pricing,
  addonLaborSubtotalCents,
  partPricingTotalCents,
  totalEstimateCents,
  onPricingChange,
}: {
  parts: ReviewPart[];
  pricing: PartPricing[];
  addonLaborSubtotalCents: number;
  partPricingTotalCents: number;
  totalEstimateCents: number;
  onPricingChange: (partKey: string, patch: Partial<Omit<PartPricing, 'partKey'>>) => void;
}) {
  return (
    <>
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Parts ready to create</CardTitle><CardDescription>One last, plain-language check before creating the order.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {parts.map((part, index) => (
            <div key={part.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
              <div>
                <p className="font-semibold">{part.partNumber || `Part ${index + 1}`}{part.partName ? ` — ${part.partName}` : ''}</p>
                <p className="text-sm text-muted-foreground">Quantity {part.quantity || '1'}{part.attachments.length ? ` · ${part.attachments.length} drawing attached` : ''}</p>
              </div>
              {part.attachments.length ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">BOM will run automatically</span> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Per-part pricing basis</CardTitle><CardDescription>Review-only estimate controls. This basis is not persisted on order create.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {parts.map((part, index) => {
            const entry = pricing.find((candidate) => candidate.partKey === part.key) ?? { partKey: part.key, price: '0.00', pricingMode: 'LOT_TOTAL' as PartPricingMode };
            const quantity = normalizeOrderQuantityInput(part.quantity);
            const lotTotal = calculatePartLotTotal({ enteredPriceCents: centsFromInput(entry.price), quantity, pricingMode: entry.pricingMode });
            return (
              <div key={part.key} className="grid gap-3 rounded border border-border/60 bg-background/60 p-3 md:grid-cols-[1.5fr_100px_160px_140px_auto] md:items-center">
                <div className="text-sm font-medium">{part.partNumber || `Part ${index + 1}`}</div>
                <div className="text-sm text-muted-foreground">Qty: {quantity}</div>
                <Input inputMode="decimal" value={entry.price} onChange={(event) => onPricingChange(part.key, { price: event.target.value })} placeholder="0.00" />
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={entry.pricingMode === 'PER_UNIT'} onCheckedChange={(checked) => onPricingChange(part.key, { pricingMode: checked ? 'PER_UNIT' : 'LOT_TOTAL' })} />
                  PER_UNIT
                </Label>
                <div className="text-sm font-medium">{formatCurrency(lotTotal)}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Estimate summary</CardTitle><CardDescription>Pricing projection from assigned add-ons and labor.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2"><span className="text-muted-foreground">Add-ons & labor subtotal</span><span className="font-medium">{formatCurrency(addonLaborSubtotalCents)}</span></div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2"><span className="text-muted-foreground">Part pricing (basis-adjusted)</span><span className="font-medium">{formatCurrency(partPricingTotalCents)}</span></div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 font-semibold"><span>Total estimate</span><span>{formatCurrency(totalEstimateCents)}</span></div>
          <p className="text-xs text-muted-foreground">Checklist-only items are excluded from pricing totals.</p>
        </CardContent>
      </Card>
    </>
  );
}
