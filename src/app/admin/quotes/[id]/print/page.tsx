import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/rbac';
import {
  DEFAULT_TEMPLATE_SECTIONS,
  normalizeSectionName,
  normalizeTemplateLayout,
} from '@/lib/document-template-layout';
import { getActiveDocumentTemplate } from '@/lib/document-templates';
import { getPartPricingEntries } from '@/lib/quote-part-pricing';
import { mergeQuoteMetadata, parseQuoteMetadata } from '@/lib/quote-metadata';

import { PrintControls } from '@/components/print/PrintControls';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export const dynamic = 'force-dynamic';

export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { templateId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessAdmin(session.user as any)) {
    redirect('/');
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      parts: {
        include: {
          material: true,
          addonSelections: true,
        },
      },
      vendorItems: true,
      addonSelections: { include: { addon: { select: { id: true, name: true, rateType: true, rateCents: true } } } },
    },
  });

  if (!quote) {
    redirect('/admin/quotes');
  }

  const [activeTemplate, templates] = await Promise.all([
    getActiveDocumentTemplate({
      documentType: 'QUOTE',
      businessCode: quote.business,
    }),
    prisma.documentTemplate.findMany({
      where: {
        documentType: 'QUOTE',
        isActive: true,
        OR: [{ businessCode: quote.business }, { businessCode: null }],
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    }),
  ]);

  const requestedTemplateId = searchParams?.templateId;
  const selectedTemplate =
    templates.find((template) => template.id === requestedTemplateId) ?? activeTemplate ?? templates[0] ?? null;
  const layout = normalizeTemplateLayout(selectedTemplate?.layoutJson);
  const layoutSections = layout.sections.length ? layout.sections : DEFAULT_TEMPLATE_SECTIONS;

  const legacyAddonSelections = quote.addonSelections.filter((selection) => !selection.quotePartId);
  const addonTotal =
    quote.parts.reduce(
      (sum, part) => sum + (part.addonSelections ?? []).reduce((innerSum, selection) => innerSum + selection.totalCents, 0),
      0
    ) + legacyAddonSelections.reduce((sum, selection) => sum + selection.totalCents, 0);
  const vendorTotal = quote.vendorItems.reduce((sum, item) => sum + item.finalPriceCents, 0);
  const total = quote.basePriceCents + addonTotal + vendorTotal;
  const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata));
  const partPricing = getPartPricingEntries({
    parts: quote.parts,
    metadata,
  });
  const addonSelections = quote.addonSelections.filter((selection) => selection.addon);
  const hasAddons = addonSelections.length > 0;
  const hasVendorItems = quote.vendorItems.length > 0;

  const headerSection = (
    <header className="flex items-start justify-between border-b border-black pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-wide">Quote #{quote.quoteNumber}</h1>
        <p className="mt-1 text-sm">
          {quote.companyName}
          {quote.contactName ? ` — Attn: ${quote.contactName}` : ''}
        </p>
      </div>
      <div className="text-right text-sm">
        <p>Date: {new Date(quote.updatedAt).toLocaleDateString()}</p>
      </div>
    </header>
  );

  const customerInfoSection = (
    <section className="border border-black">
      <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
        Customer Info
      </div>
      <div className="grid gap-1 px-3 py-3 text-xs">
        {quote.contactEmail && <p>Email: {quote.contactEmail}</p>}
        {quote.contactPhone && <p>Phone: {quote.contactPhone}</p>}
        {quote.customer?.name && <p>Customer record: {quote.customer.name}</p>}
        {!quote.contactEmail && !quote.contactPhone && !quote.customer?.name && (
          <p className="text-neutral-500">No customer contact details recorded.</p>
        )}
      </div>
    </section>
  );

  const totalSection = (
    <section className="border border-black">
      <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
        Totals
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 py-3 text-sm">
        <div>
          <p className="text-xs uppercase text-neutral-500">Subtotal</p>
          <p className="font-semibold">{formatCurrency(quote.basePriceCents)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-neutral-500">Addons &amp; vendor</p>
          <p className="font-semibold">{formatCurrency(addonTotal + vendorTotal)}</p>
        </div>
        <div className="col-span-2 border-t border-black pt-2 text-right text-base font-semibold">
          Total: {formatCurrency(total)}
        </div>
      </div>
    </section>
  );

  const scopeSection = (
    <section>
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
                {part.partNumber && <div className="text-xs">Part #: {part.partNumber}</div>}
                {part.material && <div className="text-xs">Material: {part.material.name}</div>}
                {part.stockSize && <div className="text-xs">Stock size: {part.stockSize}</div>}
                {part.cutLength && <div className="text-xs">Cut length: {part.cutLength}</div>}
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
  );

  const pricingSection = (
    <section>
      <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Part pricing</h2>
      <table className="mt-3 w-full table-fixed border-collapse border border-black text-sm">
        <thead className="bg-zinc-200">
          <tr>
            <th className="border border-black px-2 py-1 text-left">Part</th>
            <th className="border border-black px-2 py-1 text-left">Qty</th>
            <th className="border border-black px-2 py-1 text-left">Part cost</th>
          </tr>
        </thead>
        <tbody>
          {partPricing.length === 0 && (
            <tr>
              <td className="border border-black px-2 py-2 text-center text-neutral-500" colSpan={3}>
                No pricing captured
              </td>
            </tr>
          )}
          {quote.parts.map((part, index) => (
            <tr key={part.id} className="align-top">
              <td className="border border-black px-2 py-2">
                <div className="font-medium">{part.name}</div>
                {part.partNumber && <div className="text-xs">Part #: {part.partNumber}</div>}
              </td>
              <td className="border border-black px-2 py-2">{part.quantity}</td>
              <td className="border border-black px-2 py-2">
                {formatCurrency(partPricing[index]?.priceCents ?? 0)}
              </td>
            </tr>
          ))}
          {quote.parts.length > 0 && (
            <tr>
              <td className="border border-black px-2 py-2 font-semibold text-right" colSpan={2}>
                Total
              </td>
              <td className="border border-black px-2 py-2 font-semibold">{formatCurrency(total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );

  const addonsSection = (
    <section className="border border-black">
      <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
        Addons &amp; vendor items
      </div>
      <div className="px-3 py-3 text-sm">
        {!hasAddons && !hasVendorItems && <p className="text-neutral-500">No addons or vendor items.</p>}
        {hasAddons && (
          <div className="mb-3">
            <p className="text-xs uppercase text-neutral-500">Addons</p>
            <ul className="mt-1 space-y-1">
              {addonSelections.map((selection) => (
                <li key={selection.id} className="flex items-center justify-between">
                  <span>{selection.addon?.name ?? 'Addon'}</span>
                  <span className="font-semibold">{formatCurrency(selection.totalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasVendorItems && (
          <div>
            <p className="text-xs uppercase text-neutral-500">Vendor items</p>
            <ul className="mt-1 space-y-1">
              {quote.vendorItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.vendorName ?? item.partNumber ?? 'Vendor item'}</span>
                  <span className="font-semibold">{formatCurrency(item.finalPriceCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );

  const requirementsSection = (
    <section className="border border-black">
      <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
        Notes &amp; requirements
      </div>
      <div className="space-y-3 px-3 py-3 text-xs">
        {quote.materialSummary && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Materials</p>
            <p className="whitespace-pre-wrap">{quote.materialSummary}</p>
          </div>
        )}
        {quote.purchaseItems && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Purchased items</p>
            <p className="whitespace-pre-wrap">{quote.purchaseItems}</p>
          </div>
        )}
        {quote.requirements && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Requirements</p>
            <p className="whitespace-pre-wrap">{quote.requirements}</p>
          </div>
        )}
        {quote.notes && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Notes</p>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
        {!quote.materialSummary && !quote.purchaseItems && !quote.requirements && !quote.notes && (
          <p className="text-neutral-500">No additional notes recorded.</p>
        )}
      </div>
    </section>
  );

  const sectionContent: Record<string, React.ReactNode> = {
    header: headerSection,
    'customer info': customerInfoSection,
    'total price': totalSection,
    'part name': scopeSection,
    'part info': pricingSection,
    'line items': scopeSection,
    'addons labor': addonsSection,
    'addons/labor': addonsSection,
    shipping: requirementsSection,
    notes: requirementsSection,
  };

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <PrintControls
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
        }))}
        selectedTemplateId={selectedTemplate?.id ?? null}
        templateLabel="Quote template"
      />
      <div className="mt-6 space-y-6">
        {layoutSections.map((section, index) => {
          const key = normalizeSectionName(section);
          const content = sectionContent[key];
          if (!content) {
            return (
              <section key={`${section}-${index}`} className="border border-dashed border-black px-3 py-3">
                <div className="text-xs font-semibold uppercase text-gray-500">Unmapped section</div>
                <div className="text-sm">{section}</div>
              </section>
            );
          }
          return <React.Fragment key={`${section}-${index}`}>{content}</React.Fragment>;
        })}
      </div>
    </div>
  );
}
