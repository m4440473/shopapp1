'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export type QuoteCustomAmountItem = { key: string; title: string; amount: string };

type QuoteCustomAmountsCardProps = {
  items: QuoteCustomAmountItem[];
  onChange: (key: string, patch: Partial<QuoteCustomAmountItem>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
};

export function QuoteCustomAmountsCard({ items, onChange, onRemove, onAdd }: QuoteCustomAmountsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom amounts</CardTitle>
        <CardDescription>Add manual one-off quote amounts with a title. These flow into the final estimate and convert into order charges using the quote origin department.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length ? items.map((item) => (
          <div key={item.key} className="grid gap-3 rounded border border-border/60 bg-background/60 p-3 md:grid-cols-[1.4fr_180px_auto] md:items-end">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={item.title} onChange={(event) => onChange(item.key, { title: event.target.value })} placeholder="Rush setup" />
            </div>
            <div className="grid gap-2">
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" min="0" value={item.amount} onChange={(event) => onChange(item.key, { amount: event.target.value })} placeholder="0.00" />
            </div>
            <Button type="button" variant="ghost" onClick={() => onRemove(item.key)}>Remove</Button>
          </div>
        )) : (
          <div className="rounded border border-dashed border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">No manual custom amounts added.</div>
        )}
        <Button type="button" variant="outline" onClick={onAdd}>Add custom amount</Button>
      </CardContent>
    </Card>
  );
}
