'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { RepeatOrderTemplateSummary } from '@/modules/repeat-orders/repeat-orders.types';

type CustomerRepeatTemplateSectionProps = {
  customerId: string;
  customerName: string;
};

const formatDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const extractErrorMessage = async (res: Response, fallback: string) => {
  try {
    const payload = await res.json();
    const direct = typeof payload?.error === 'string' ? payload.error : null;
    if (direct) return direct;
    const nested = typeof payload?.error?.message === 'string' ? payload.error.message : null;
    return nested ?? fallback;
  } catch {
    return fallback;
  }
};

export function CustomerRepeatTemplateSection({
  customerId,
  customerName,
}: CustomerRepeatTemplateSectionProps) {
  const [items, setItems] = React.useState<RepeatOrderTemplateSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ customerId, take: '12' });
      const res = await fetch(`/api/repeat-order-templates?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Failed to load repeat-order templates.'));
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError: any) {
      setItems([]);
      setError(
        typeof loadError?.message === 'string'
          ? loadError.message
          : 'Failed to load repeat-order templates.',
      );
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">Repeat-order templates</CardTitle>
            <CardDescription>
              Saved build definitions for fast reorders for {customerName}.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadTemplates()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading repeat-order templates...</p>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : items.length ? (
          items.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/10 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-foreground">{template.name}</p>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide">
                      {template.partCount} {template.partCount === 1 ? 'part' : 'parts'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-wide">
                      {template.priority}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Business: {template.business}</p>
                    <p>
                      Source order:{' '}
                      {template.sourceOrderId && template.sourceOrderNumber ? (
                        <Link
                          href={`/orders/${template.sourceOrderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          #{template.sourceOrderNumber}
                        </Link>
                      ) : (
                        'Not linked'
                      )}
                    </p>
                    <p>Updated {formatDateTime(template.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={`/orders/new?templateId=${template.id}`}>Create repeat order</Link>
                  </Button>
                  {template.sourceOrderId ? (
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <Link href={`/orders/${template.sourceOrderId}`}>View source order</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            No repeat templates saved yet. Save a proven order as a repeat template, then launch reorders here in one click.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
