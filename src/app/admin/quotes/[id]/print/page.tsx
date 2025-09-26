import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export const dynamic = 'force-dynamic';

export default async function QuotePrintPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin((session.user as any)?.role)) {
    redirect('/');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      parts: true,
      vendorItems: true,
      addonSelections: { include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } } },
    },
  });

  if (!quote) {
    redirect('/admin/quotes');
  }

  const addonTotal = quote.addonSelections.reduce((sum, selection) => sum + selection.totalCents, 0);
  const vendorTotal = quote.vendorItems.reduce((sum, item) => sum + item.finalPriceCents, 0);
  const total = quote.basePriceCents + addonTotal + vendorTotal;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <header className="flex items-start justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Quote #{quote.quoteNumber}</h1>
          <p className="mt-1 text-sm">
            {quote.companyName}
            {quote.contactName ? ` — Attn: ${quote.contactName}` : ''}
          </p>
          {quote.contactEmail && <p className="text-xs">Email: {quote.contactEmail}</p>}
          {quote.contactPhone && <p className="text-xs">Phone: {quote.contactPhone}</p>}
          {quote.customer?.name && <p className="text-xs">Customer record: {quote.customer.name}</p>}
        </div>
        <div className="text-right text-sm">
          <p>Date: {new Date(quote.updatedAt).toLocaleDateString()}</p>
          <p className="font-semibold">Total: {formatCurrency(total)}</p>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Scope of work</h2>
        <table className="mt-3 w-full table-fixed border-collapse border border-black text-sm">
          <thead className="bg-zinc-200">
            <tr>
              <th className="border border-black px-2 py-1 text-left">Part / Assembly</th>
              <th className="border border-black px-2 py-1 text-left">Qty</th>
              <th className="border border-black px-2 py-1 text-left">Pieces</th>
              <th className="border border-black px-2 py-1 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {quote.parts.length === 0 && (
              <tr>
                <td className="border border-black px-2 py-2 text-center text-neutral-500">No parts recorded</td>
                <td className="border border-black px-2 py-2" />
                <td className="border border-black px-2 py-2" />
                <td className="border border-black px-2 py-2" />
              </tr>
            )}
            {quote.parts.map((part) => (
              <tr key={part.id} className="align-top">
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{part.name}</div>
                  {part.description && <div className="mt-1 whitespace-pre-wrap text-xs">{part.description}</div>}
                </td>
                <td className="border border-black px-2 py-2">{part.quantity}</td>
                <td className="border border-black px-2 py-2">{part.pieceCount}</td>
                <td className="border border-black px-2 py-2 whitespace-pre-wrap text-xs">{part.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Purchased items</h2>
        <table className="mt-3 w-full table-fixed border-collapse border border-black text-sm">
          <thead className="bg-zinc-200">
            <tr>
              <th className="border border-black px-2 py-1 text-left">Vendor</th>
              <th className="border border-black px-2 py-1 text-left">Part #</th>
              <th className="border border-black px-2 py-1 text-left">URL</th>
              <th className="border border-black px-2 py-1 text-left">Price</th>
            </tr>
          </thead>
          <tbody>
            {quote.vendorItems.length === 0 && (
              <tr>
                <td className="border border-black px-2 py-2 text-center text-neutral-500" colSpan={4}>
                  No purchased items
                </td>
              </tr>
            )}
            {quote.vendorItems.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{item.vendorName || 'Vendor not specified'}</div>
                  {item.notes && <div className="mt-1 text-xs">{item.notes}</div>}
                </td>
                <td className="border border-black px-2 py-2">{item.partNumber || '—'}</td>
                <td className="border border-black px-2 py-2 break-words text-xs">{item.partUrl || '—'}</td>
                <td className="border border-black px-2 py-2">{formatCurrency(item.finalPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Labor / add-ons</h2>
        <table className="mt-3 w-full table-fixed border-collapse border border-black text-sm">
          <thead className="bg-zinc-200">
            <tr>
              <th className="border border-black px-2 py-1 text-left">Add-on</th>
              <th className="border border-black px-2 py-1 text-left">Units</th>
              <th className="border border-black px-2 py-1 text-left">Rate</th>
              <th className="border border-black px-2 py-1 text-left">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {quote.addonSelections.length === 0 && (
              <tr>
                <td className="border border-black px-2 py-2 text-center text-neutral-500" colSpan={4}>
                  No add-ons captured
                </td>
              </tr>
            )}
            {quote.addonSelections.map((selection) => (
              <tr key={selection.id} className="align-top">
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{selection.addon?.name ?? 'Add-on removed'}</div>
                  {selection.notes && <div className="mt-1 text-xs">{selection.notes}</div>}
                </td>
                <td className="border border-black px-2 py-2">{selection.units}</td>
                <td className="border border-black px-2 py-2">{formatCurrency(selection.rateCents)}</td>
                <td className="border border-black px-2 py-2">{formatCurrency(selection.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Totals</h2>
        <div className="mt-3 grid max-w-md gap-2 text-sm">
          <div className="flex justify-between">
            <span>Base fabrication</span>
            <span>{formatCurrency(quote.basePriceCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Vendor purchases</span>
            <span>{formatCurrency(vendorTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Add-ons & labor</span>
            <span>{formatCurrency(addonTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-black pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
