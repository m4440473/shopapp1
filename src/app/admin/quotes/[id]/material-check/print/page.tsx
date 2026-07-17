import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { findQuoteById } from '@/modules/quotes/quotes.service';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const box = (checked: boolean) => checked ? '☒' : '☐';

export default async function MaterialCheckPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) redirect('/');

  const { id } = await params;
  const quote = await findQuoteById(id);
  if (!quote) redirect('/admin/quotes');

  const printedBy = (session.user as any)?.name || (session.user as any)?.email || 'Admin';

  return (
    <main className="walkdown-root mx-auto max-w-[8.5in] bg-white p-8 text-black print:max-w-none print:p-0">
      <style>{`@page { size: letter portrait; margin: 0.45in; } @media print { body { background: white !important; } body * { visibility: hidden; } .walkdown-root, .walkdown-root * { visibility: visible; } .walkdown-root { position: absolute; inset: 0; width: 100%; } .walkdown-part { break-inside: avoid; } }`}</style>
      <div className="mb-5 flex items-start justify-between gap-4 border-b-4 border-[#0b1f3a] pb-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#ff5a00]">Material shop walkdown</p>
          <h1 className="text-3xl font-black">Quote {quote.quoteNumber}</h1>
          <p className="mt-1 text-lg font-semibold">{quote.customer?.name || quote.companyName}</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-2 border border-black p-3 text-sm">
        <p><strong>Printed:</strong> {new Date().toLocaleString()}</p>
        <p><strong>Prepared by:</strong> {printedBy}</p>
        <p><strong>Contact:</strong> {quote.contactName || '—'}</p>
        <p><strong>Parts:</strong> {quote.parts.length}</p>
      </div>

      <div className="space-y-4">
        {quote.parts.map((part, index) => (
          <section key={part.id} className="walkdown-part rounded border-2 border-black p-4">
            <div className="flex items-start justify-between gap-4 border-b border-black pb-2">
              <div>
                <p className="text-xs font-bold uppercase">Part {index + 1}</p>
                <h2 className="text-xl font-black">{part.partNumber || 'No part number'} — {part.name}</h2>
              </div>
              <p className="text-xl font-black">QTY {part.quantity}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><strong>Matched material:</strong> {part.material?.name || 'Not matched'}</p>
              <p><strong>Drawing says:</strong> {part.drawingMaterialText || 'Not shown'}</p>
              <p><strong>Stock size:</strong> {part.stockSize || 'Not shown'}</p>
              <p><strong>Cut length:</strong> {part.cutLength || 'Not shown'}</p>
              <p className="col-span-2"><strong>Finish:</strong> {part.finish || part.drawingFinishText || 'Not shown'}</p>
              <p className="col-span-2 min-h-8"><strong>Part note:</strong> {part.notes || '________________________________________________________________'}</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-y-2 border-black py-3 text-center text-lg font-black">
              <span>{box(part.materialStatus === 'IN_STOCK')} IN STOCK</span>
              <span>{box(part.materialStatus === 'NEED_TO_ORDER')} NEED TO ORDER</span>
              <span>{box(part.materialStatus === 'NOT_REQUIRED')} NOT REQUIRED</span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <p><strong>Found at:</strong> {part.inventoryLocation || '____________________________________________________________'}</p>
              <p><strong>Vendor:</strong> {part.procurementVendor?.name || '______________________________________________________________'}</p>
              <p><strong>Notes:</strong> {part.materialNotes || '__________________________________________________________________'}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
