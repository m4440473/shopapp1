import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  EXPIRED: 'Expired',
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export const dynamic = 'force-dynamic';

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin((session.user as any)?.role)) {
    redirect('/');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      parts: true,
      vendorItems: true,
      addonSelections: {
        include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } },
      },
      attachments: true,
    },
  });

  if (!quote) {
    notFound();
  }

  const statusLabel = STATUS_LABELS[quote.status] ?? quote.status;
  const addonTotal = quote.addonSelections.reduce((sum, selection) => sum + selection.totalCents, 0);
  const vendorTotal = quote.vendorItems.reduce((sum, item) => sum + item.finalPriceCents, 0);

  return (
    <div className="p-4 text-neutral-100 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quote {quote.quoteNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Prepared for {quote.companyName}
            {quote.contactName ? ` — attention: ${quote.contactName}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Created by {quote.createdBy?.name || quote.createdBy?.email || 'Unknown'} and last updated on{' '}
            {new Date(quote.updatedAt).toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/admin/quotes/${quote.id}/edit`}>Edit quote</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/quotes/${quote.id}/print`} target="_blank" rel="noopener noreferrer">
              Print
            </Link>
          </Button>
          <Button variant="ghost" disabled title="Conversion to orders coming soon">
            Convert to order
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Primary contact and status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{statusLabel}</span>
            </div>
            {quote.customer?.name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{quote.customer.name}</span>
              </div>
            )}
            {quote.contactEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{quote.contactEmail}</span>
              </div>
            )}
            {quote.contactPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{quote.contactPhone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
            <CardDescription>Only administrators can see internal pricing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base fabrication</span>
              <span className="font-medium">{formatCurrency(quote.basePriceCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendor purchases</span>
              <span className="font-medium">{formatCurrency(vendorTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Add-ons and labor</span>
              <span className="font-medium">{formatCurrency(addonTotal)}</span>
            </div>
            <div className="border-t border-border/60 pt-2 flex justify-between text-base font-semibold">
              <span>Total estimate</span>
              <span className="text-primary">{formatCurrency(quote.totalCents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Materials & notes</CardTitle>
          <CardDescription>Context captured during quoting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {quote.materialSummary && (
            <div>
              <h3 className="font-medium mb-1">Materials</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{quote.materialSummary}</p>
            </div>
          )}
          {quote.purchaseItems && (
            <div>
              <h3 className="font-medium mb-1">Purchase items</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{quote.purchaseItems}</p>
            </div>
          )}
          {quote.requirements && (
            <div>
              <h3 className="font-medium mb-1">Requirements</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{quote.requirements}</p>
            </div>
          )}
          {quote.notes && (
            <div>
              <h3 className="font-medium mb-1">Internal notes</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>
            </div>
          )}
          {!quote.materialSummary && !quote.purchaseItems && !quote.requirements && !quote.notes && (
            <p className="text-muted-foreground">No additional notes recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parts</CardTitle>
          <CardDescription>Assemblies and components captured on the quote.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.parts.length === 0 && <p className="text-sm text-muted-foreground">No parts recorded.</p>}
          {quote.parts.map((part) => (
            <div key={part.id} className="rounded border border-border/50 bg-card/40 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-medium">{part.name}</h3>
                <span className="text-muted-foreground">
                  Qty {part.quantity} • Pieces {part.pieceCount}
                </span>
              </div>
              {part.description && (
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{part.description}</p>
              )}
              {part.notes && (
                <p className="mt-2 text-xs text-muted-foreground">Notes: {part.notes}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchased items</CardTitle>
          <CardDescription>Vendor-sourced components and their markups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.vendorItems.length === 0 && <p className="text-sm text-muted-foreground">No purchased items.</p>}
          {quote.vendorItems.map((item) => (
            <div key={item.id} className="rounded border border-border/50 bg-card/40 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{item.vendorName || 'Vendor not specified'}</p>
                  {item.partNumber && <p className="text-xs text-muted-foreground">Part #: {item.partNumber}</p>}
                  {item.partUrl && (
                    <Link
                      href={item.partUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      View link
                    </Link>
                  )}
                </div>
                <div className="text-right">
                  <p>{formatCurrency(item.finalPriceCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Base {formatCurrency(item.basePriceCents)} • Markup {item.markupPercent}%
                  </p>
                </div>
              </div>
              {item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add-ons & labor</CardTitle>
          <CardDescription>Hourly or fixed-rate services applied to the quote.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.addonSelections.length === 0 && <p className="text-sm text-muted-foreground">No add-ons applied.</p>}
          {quote.addonSelections.map((selection) => (
            <div key={selection.id} className="rounded border border-border/50 bg-card/40 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{selection.addon?.name ?? 'Add-on removed'}</p>
                  <p className="text-xs text-muted-foreground">
                    {selection.units} {selection.rateTypeSnapshot === 'FLAT' ? 'qty' : 'hrs'} • Rate{' '}
                    {formatCurrency(selection.rateCents)}
                  </p>
                </div>
                <div className="text-right font-medium">{formatCurrency(selection.totalCents)}</div>
              </div>
              {selection.notes && <p className="mt-2 text-xs text-muted-foreground">{selection.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>Drawings and supporting documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {quote.attachments.length === 0 && <p className="text-muted-foreground">No attachments linked.</p>}
          {quote.attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between gap-4 rounded border border-border/40 bg-card/30 p-3">
              <div>
                <p className="font-medium">{attachment.label || attachment.url}</p>
                {attachment.mimeType && <p className="text-xs text-muted-foreground">{attachment.mimeType}</p>}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={attachment.url} target="_blank" rel="noopener noreferrer">
                  View
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
