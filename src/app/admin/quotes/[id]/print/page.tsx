import React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';

import { canAccessAdmin } from '@/lib/rbac';
import { normalizeTemplateLayout } from '@/lib/document-template-layout';
import { getPartPricingEntries } from '@/lib/quote-part-pricing';
import { mergeQuoteMetadata, parseQuoteMetadata } from '@/lib/quote-metadata';
import { calculatePartLotTotal, calculatePartUnitPrice } from '@/modules/pricing/part-pricing';
import { calculatePartPricingSummaryTotalsCents } from '@/modules/pricing/work-item-pricing';
import {
  buildQuoteRenderBlocks,
  DEFAULT_QUOTE_ADDONS_OPTIONS,
  DEFAULT_QUOTE_PRICING_OPTIONS,
  DEFAULT_QUOTE_REQUIREMENTS_OPTIONS,
  DEFAULT_QUOTE_SCOPE_OPTIONS,
} from '@/lib/quote-print-layout';

import { PrintControls } from '@/components/print/PrintControls';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export const dynamic = 'force-dynamic';

export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session || !canAccessAdmin(session.user as any)) {
    redirect('/');
  }

  const headerStore = await headers();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  const baseUrl = host ? `${protocol}://${host}` : '';
  const cookie = headerStore.get('cookie') ?? '';

  const response = await fetch(`${baseUrl}/api/admin/quotes/${id}/print-data`, {
    headers: { cookie },
    cache: 'no-store',
  });
  if (!response.ok) {
    redirect('/admin/quotes');
  }
  const payload = await response.json();
  const quote = payload?.quote ?? null;
  const templates = payload?.templates ?? [];
  const activeTemplate = payload?.activeTemplate ?? null;

  if (!quote) {
    redirect('/admin/quotes');
  }

  const requestedTemplateId = resolvedSearchParams?.templateId;
  const selectedTemplate =
    templates.find((template) => template.id === requestedTemplateId) ?? activeTemplate ?? templates[0] ?? null;
  const layout = normalizeTemplateLayout(selectedTemplate?.layoutJson);
  const renderBlocks = buildQuoteRenderBlocks(layout).filter((block) => block.visible);

  const legacyAddonSelections = quote.addonSelections.filter((selection) => !selection.quotePartId);
  const vendorTotal = quote.vendorItems.reduce((sum, item) => sum + item.finalPriceCents, 0);
  const metadata = mergeQuoteMetadata(parseQuoteMetadata(quote.metadata));
  const partPricing = getPartPricingEntries({
    parts: quote.parts,
    metadata,
  });
  const partPricingRows = quote.parts.map((part, index) => {
    const entry = partPricing[index] ?? {
      name: part.name,
      partNumber: part.partNumber ?? null,
      priceCents: 0,
      pricingMode: 'LOT_TOTAL' as const,
    };
    const pricingMode = entry.pricingMode === 'PER_UNIT' ? 'PER_UNIT' : 'LOT_TOTAL';
    const quantity = Number(part.quantity ?? 0);
    const unitPriceCents = calculatePartUnitPrice({
      enteredPriceCents: entry.priceCents,
      quantity,
      pricingMode,
    });
    const lineTotalCents = calculatePartLotTotal({
      enteredPriceCents: entry.priceCents,
      quantity,
      pricingMode,
    });
    return {
      part,
      pricingMode,
      quantity,
      unitPriceCents,
      lineTotalCents,
    };
  });
  const pricingSummaryTotals = calculatePartPricingSummaryTotalsCents({
    parts: quote.parts.map((part, index) => {
      const entry = partPricing[index];
      const enteredPriceCents = entry?.priceCents ?? 0;
      return {
        workItemsSubtotalCents: (part.addonSelections ?? []).reduce(
          (sum, selection) => sum + selection.totalCents,
          0
        ),
        partPricingSubtotalCents:
          enteredPriceCents > 0
            ? partPricingRows[index]?.lineTotalCents ?? 0
            : 0,
        hasPartPricingOverride: enteredPriceCents > 0,
      };
    }),
  });
  const addonTotal =
    pricingSummaryTotals.addonsAndLaborCents +
    legacyAddonSelections.reduce((sum, selection) => sum + selection.totalCents, 0);
  const partPricingTotal = pricingSummaryTotals.partPricingCents;
  const total = quote.basePriceCents + addonTotal + vendorTotal + partPricingTotal;
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
        <div>
          <p className="text-xs uppercase text-neutral-500">Part pricing</p>
          <p className="font-semibold">{formatCurrency(partPricingTotal)}</p>
        </div>
        <div className="col-span-2 border-t border-black pt-2 text-right text-base font-semibold">
          Total: {formatCurrency(total)}
        </div>
      </div>
    </section>
  );

  const renderScopeSection = (
    scopeOptions = DEFAULT_QUOTE_SCOPE_OPTIONS,
    variant: 'standard' | 'compact' = 'standard'
  ) => {
    const compact = variant === 'compact';
    const detailTextClass = compact ? 'text-[11px]' : 'text-xs';
    const showQty = scopeOptions.showQuantity !== false;
    const showPieces = scopeOptions.showPieces !== false;
    const showNotes = scopeOptions.showNotes !== false;
    const columnCount = 1 + Number(showQty) + Number(showPieces) + Number(showNotes);

    return (
      <section>
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Scope of work</h2>
        <table className={`mt-3 w-full table-fixed border-collapse border border-black ${compact ? 'text-xs' : 'text-sm'}`}>
          <thead className="bg-zinc-200">
            <tr>
              <th className="border border-black px-2 py-1 text-left">Part / Assembly</th>
              {showQty ? <th className="border border-black px-2 py-1 text-left">Qty</th> : null}
              {showPieces ? <th className="border border-black px-2 py-1 text-left">Pieces</th> : null}
              {showNotes ? <th className="border border-black px-2 py-1 text-left">Notes</th> : null}
            </tr>
          </thead>
          <tbody>
            {quote.parts.length === 0 && (
              <tr>
                <td className="border border-black px-2 py-2 text-center text-neutral-500" colSpan={columnCount}>No parts recorded</td>
              </tr>
            )}
            {quote.parts.map((part) => (
              <tr key={part.id} className="align-top">
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{part.name}</div>
                  {scopeOptions.showPartNumber !== false && part.partNumber ? <div className={detailTextClass}>Part #: {part.partNumber}</div> : null}
                  {scopeOptions.showMaterial !== false && part.material ? <div className={detailTextClass}>Material: {part.material.name}</div> : null}
                  {scopeOptions.showStockSize !== false && part.stockSize ? <div className={detailTextClass}>Stock size: {part.stockSize}</div> : null}
                  {scopeOptions.showCutLength !== false && part.cutLength ? <div className={detailTextClass}>Cut length: {part.cutLength}</div> : null}
                  {scopeOptions.showDescription !== false && part.description ? <div className={`mt-1 whitespace-pre-wrap ${detailTextClass}`}>{part.description}</div> : null}
                </td>
                {showQty ? <td className="border border-black px-2 py-2">{part.quantity}</td> : null}
                {showPieces ? <td className="border border-black px-2 py-2">{part.pieceCount}</td> : null}
                {showNotes ? <td className={`border border-black px-2 py-2 whitespace-pre-wrap ${detailTextClass}`}>{part.notes || ''}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };

  const renderPricingSection = (pricingOptions = DEFAULT_QUOTE_PRICING_OPTIONS, variant: 'standard' | 'compact' = 'standard') => {
    const showUnit = pricingOptions.showUnitPrice !== false;
    const showQty = pricingOptions.showQuantity !== false;
    const showLine = pricingOptions.showLineTotal !== false;
    const showMode = pricingOptions.showPricingMode !== false;
    const compact = variant === 'compact';

    return (
      <section>
        <h2 className="border-b border-black pb-1 text-lg font-semibold uppercase tracking-wide">Part pricing</h2>
        <table className={`mt-3 w-full table-fixed border-collapse border border-black ${compact ? 'text-xs' : 'text-sm'}`}>
          <thead className="bg-zinc-200">
            <tr>
              <th className="border border-black px-2 py-1 text-left">Part</th>
              {showUnit ? <th className="border border-black px-2 py-1 text-left">Unit price</th> : null}
              {showQty ? <th className="border border-black px-2 py-1 text-left">Qty</th> : null}
              {showLine ? <th className="border border-black px-2 py-1 text-left">Line total</th> : null}
            </tr>
          </thead>
          <tbody>
            {partPricing.length === 0 && (
              <tr>
                <td className="border border-black px-2 py-2 text-center text-neutral-500" colSpan={1 + Number(showUnit) + Number(showQty) + Number(showLine)}>
                  No pricing captured
                </td>
              </tr>
            )}
            {partPricingRows.map((row) => (
              <tr key={row.part.id} className="align-top">
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{row.part.name}</div>
                  {row.part.partNumber && <div className="text-xs">Part #: {row.part.partNumber}</div>}
                  {showMode ? <div className="text-xs text-neutral-500">Mode: {row.pricingMode}</div> : null}
                </td>
                {showUnit ? <td className="border border-black px-2 py-2">{formatCurrency(row.unitPriceCents)}</td> : null}
                {showQty ? <td className="border border-black px-2 py-2">{row.quantity}</td> : null}
                {showLine ? <td className="border border-black px-2 py-2">{formatCurrency(row.lineTotalCents)}</td> : null}
              </tr>
            ))}
            {partPricingRows.length > 0 && showLine && (
              <tr>
                <td className="border border-black px-2 py-2 font-semibold text-right" colSpan={1 + Number(showUnit) + Number(showQty)}>
                  Part pricing total
                </td>
                <td className="border border-black px-2 py-2 font-semibold">{formatCurrency(partPricingTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    );
  };

  const renderAddonsSection = (
    addonsOptions = DEFAULT_QUOTE_ADDONS_OPTIONS,
    variant: 'standard' | 'compact' = 'standard'
  ) => {
    const compact = variant === 'compact';
    const textClass = compact ? 'text-xs' : 'text-sm';
    const metaClass = compact ? 'text-[11px]' : 'text-xs';
    const partSelections = quote.parts.flatMap((part) =>
      (part.addonSelections ?? []).map((selection) => ({
        id: selection.id,
        addonName: selection.addon?.name ?? 'Addon',
        totalCents: selection.totalCents,
        units: selection.units,
        notes: selection.notes,
        partName: part.name,
        partNumber: part.partNumber,
      }))
    );
    const showPrices = addonsOptions.showPrices !== false;
    const showUnits = addonsOptions.showUnits === true;
    const showNotes = addonsOptions.showNotes === true;
    const showPartContext = addonsOptions.showPartContext === true;
    const showVendorItems = addonsOptions.showVendorItems !== false;
    const hasVisibleVendorItems = showVendorItems && hasVendorItems;

    return (
      <section className="border border-black">
        <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
          Addons &amp; vendor items
        </div>
        <div className={`px-3 py-3 ${textClass}`}>
          {!hasAddons && !hasVisibleVendorItems && <p className="text-neutral-500">No addons or vendor items.</p>}
          {hasAddons && (
            <div className="mb-3">
              <p className={`${metaClass} uppercase text-neutral-500`}>Addons / labor</p>
              <ul className="mt-1 space-y-1">
                {partSelections.map((selection) => (
                  <li key={selection.id} className={`flex items-start justify-between gap-4 ${showPrices ? '' : 'justify-start'}`}>
                    <div>
                      <div>{selection.addonName}</div>
                      {showPartContext ? (
                        <div className={`${metaClass} text-neutral-500`}>
                          {selection.partName}
                          {selection.partNumber ? ` (${selection.partNumber})` : ''}
                        </div>
                      ) : null}
                      {showUnits ? <div className={`${metaClass} text-neutral-500`}>Units: {selection.units}</div> : null}
                      {showNotes && selection.notes ? <div className={`${metaClass} whitespace-pre-wrap text-neutral-500`}>{selection.notes}</div> : null}
                    </div>
                    {showPrices ? <span className="font-semibold">{formatCurrency(selection.totalCents)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasVisibleVendorItems && (
            <div>
              <p className={`${metaClass} uppercase text-neutral-500`}>Vendor items</p>
              <ul className="mt-1 space-y-1">
                {quote.vendorItems.map((item) => (
                  <li key={item.id} className={`flex items-start justify-between gap-4 ${showPrices ? '' : 'justify-start'}`}>
                    <div>
                      <div>{item.vendorName ?? item.partNumber ?? 'Vendor item'}</div>
                      {item.partNumber && item.vendorName ? <div className={`${metaClass} text-neutral-500`}>Part #: {item.partNumber}</div> : null}
                      {showNotes && item.notes ? <div className={`${metaClass} whitespace-pre-wrap text-neutral-500`}>{item.notes}</div> : null}
                    </div>
                    {showPrices ? <span className="font-semibold">{formatCurrency(item.finalPriceCents)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderRequirementsSection = (requirementsOptions = DEFAULT_QUOTE_REQUIREMENTS_OPTIONS) => (
    <section className="border border-black">
      <div className="border-b border-black bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase">
        Notes &amp; requirements
      </div>
      <div className="space-y-3 px-3 py-3 text-xs">
        {requirementsOptions.showMaterials !== false && quote.materialSummary && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Materials</p>
            <p className="whitespace-pre-wrap">{quote.materialSummary}</p>
          </div>
        )}
        {requirementsOptions.showPurchasedItems !== false && quote.purchaseItems && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Purchased items</p>
            <p className="whitespace-pre-wrap">{quote.purchaseItems}</p>
          </div>
        )}
        {requirementsOptions.showRequirements !== false && quote.requirements && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Requirements</p>
            <p className="whitespace-pre-wrap">{quote.requirements}</p>
          </div>
        )}
        {requirementsOptions.showNotes !== false && quote.notes && (
          <div>
            <p className="font-semibold uppercase text-neutral-500">Notes</p>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
        {!(requirementsOptions.showMaterials !== false && quote.materialSummary) &&
        !(requirementsOptions.showPurchasedItems !== false && quote.purchaseItems) &&
        !(requirementsOptions.showRequirements !== false && quote.requirements) &&
        !(requirementsOptions.showNotes !== false && quote.notes) ? (
          <p className="text-neutral-500">No additional notes recorded.</p>
        ) : null}
      </div>
    </section>
  );

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
        {renderBlocks.map((block, index) => {
          const key = block.type;
          const content =
            key === 'header'
              ? headerSection
              : key === 'customer_info'
                ? customerInfoSection
                : key === 'total_price'
                  ? totalSection
                  : key === 'scope'
                    ? renderScopeSection(block.scopeOptions ?? DEFAULT_QUOTE_SCOPE_OPTIONS, block.variant)
                    : key === 'part_pricing'
                      ? renderPricingSection(block.pricingOptions ?? DEFAULT_QUOTE_PRICING_OPTIONS, block.variant)
                      : key === 'addons_labor'
                        ? renderAddonsSection(block.addonsOptions ?? DEFAULT_QUOTE_ADDONS_OPTIONS, block.variant)
                        : key === 'requirements'
                          ? renderRequirementsSection(block.requirementsOptions ?? DEFAULT_QUOTE_REQUIREMENTS_OPTIONS)
                          : null;

          if (!content) {
            return (
              <section key={`${block.id}-${index}`} className="border border-dashed border-black px-3 py-3">
                <div className="text-xs font-semibold uppercase text-gray-500">Unmapped block</div>
                <div className="text-sm">{block.label}</div>
              </section>
            );
          }
          return <React.Fragment key={`${block.id}-${index}`}>{content}</React.Fragment>;
        })}
      </div>
    </div>
  );
}
