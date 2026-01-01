import { format } from 'date-fns';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';

function formatDate(input?: string | Date | null, withTime = false) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, withTime ? 'M/d/yyyy h:mm a' : 'M/d/yyyy');
}

type SortableAddon = {
  id: string;
  name: string;
};

const addonPriority = [
  'Anodize',
  'Program / Setup',
  'CNC Lathe',
  'CNC Mill',
  'Manual Lathe',
  'Manual Mill',
  'Saw',
  'Weld / Fabricate',
  'Deburr',
  'Heat Treat',
  'Grind',
  'Stamp',
  'Inspect',
  'Paint',
  'Black Oxide',
  'Shop',
  'Scrap',
  'Plating',
  'Powder Coating',
  'Wet Paint',
  'Zinc',
];

function sortAddons(addons: SortableAddon[]) {
  return [...addons].sort((a, b) => {
    const aIndex = addonPriority.indexOf(a.name);
    const bIndex = addonPriority.indexOf(b.name);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      if (aIndex !== bIndex) return aIndex - bIndex;
    }
    return a.name.localeCompare(b.name);
  });
}

function formatStepNumber(idx: number) {
  return String(idx + 1).padStart(3, '0');
}

export default async function OrderPrintPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/orders/${params.id}/print`);
  }

  const [order, activeAddons] = await Promise.all([
    prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        assignedMachinist: true,
        vendor: true,
        parts: { include: { material: true } },
        checklist: { include: { addon: true } },
        attachments: true,
        notes: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        statusHistory: true,
      },
    }),
    prisma.addon.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!order) {
    notFound();
  }

  const safeOrder = sanitizePricingForNonAdmin(order);
  const safeAddons = activeAddons.map(({ rateCents: _rateCents, ...addon }) => addon);
  const sortedAddons = sortAddons(safeAddons);
  const selectedAddonIds = new Set(safeOrder.checklist.map((item) => item.addonId));
  const partSummaries = safeOrder.parts.map((part) => {
    const details = [
      `Qty: ${part.quantity}`,
      part.material?.name ? `Material: ${part.material.name}` : null,
      part.stockSize ? `Stock: ${part.stockSize}` : null,
      part.cutLength ? `Cut: ${part.cutLength}` : null,
    ].filter(Boolean);
    return `${part.partNumber}${details.length ? ` (${details.join(' • ')})` : ''}`;
  });
  const totalQuantity = safeOrder.parts.reduce((sum, part) => sum + part.quantity, 0);
  const materialsUsed = Array.from(new Set(safeOrder.parts.map((part) => part.material?.name).filter(Boolean)));
  const notesContent = safeOrder.notes
    .map((note) => `${formatDate(note.createdAt)} - ${note.user?.name ?? 'User'}: ${note.content}`)
    .join('\n');
  const printableDate = safeOrder.receivedDate ?? safeOrder.dueDate ?? new Date();

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-sm text-black print:p-4">
      <div className="space-y-6 border border-black p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black pb-4">
          <div>
            <h1 className="text-xl font-extrabold uppercase">C&amp;R Machine &amp; Fabrication</h1>
            <p className="text-lg font-semibold uppercase">Job Router</p>
          </div>
          <div className="text-right text-xs uppercase text-gray-700">
            <p className="font-semibold">Order #{safeOrder.orderNumber}</p>
            <p>Priority: {safeOrder.priority}</p>
            <p>Due: {formatDate(safeOrder.dueDate)}</p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-black">
            <div className="grid grid-cols-[110px,1fr] text-sm">
              <div className="col-span-2 border-b border-black bg-gray-100 px-2 py-1 text-xs font-semibold uppercase">
                Job Details
              </div>
              <div className="border-b border-black px-2 py-2 font-semibold">Job #</div>
              <div className="border-b border-black px-2 py-2">{safeOrder.orderNumber}</div>
              <div className="border-b border-black px-2 py-2 font-semibold">Due Date</div>
              <div className="border-b border-black px-2 py-2">{formatDate(safeOrder.dueDate)}</div>
              <div className="border-b border-black px-2 py-2 font-semibold">P.O. #</div>
              <div className="border-b border-black px-2 py-2">{safeOrder.poNumber ?? '—'}</div>
              <div className="px-2 py-2 font-semibold">Machinist</div>
              <div className="px-2 py-2">
                {safeOrder.assignedMachinist?.name ?? safeOrder.assignedMachinist?.email ?? 'Unassigned'}
              </div>
            </div>
          </div>

          <div className="border border-black">
            <div className="grid grid-cols-[110px,1fr] text-sm">
              <div className="col-span-2 border-b border-black bg-gray-100 px-2 py-1 text-xs font-semibold uppercase">
                Part Information
              </div>
              <div className="border-b border-black px-2 py-2 font-semibold">Part #(s)</div>
              <div className="border-b border-black px-2 py-2">
                {partSummaries.length ? (
                  <ul className="space-y-1">
                    {partSummaries.map((summary) => (
                      <li key={summary} className="flex items-center justify-between gap-2">
                        <span>{summary}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="border-b border-black px-2 py-2 font-semibold">Quantity</div>
              <div className="border-b border-black px-2 py-2 font-semibold">{totalQuantity}</div>
              <div className="px-2 py-2 font-semibold">Date</div>
              <div className="px-2 py-2">{formatDate(printableDate)}</div>
            </div>
          </div>
        </section>

        <section className="border border-black">
          <div className="border-b border-black bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            Shipping Box Information
          </div>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-1/4 border-r border-black px-2 py-2 text-left font-semibold">Box</th>
                <th className="w-1/4 border-r border-black px-2 py-2 text-left font-semibold">Weight</th>
                <th className="w-1/4 border-r border-black px-2 py-2 text-left font-semibold">Qty</th>
                <th className="px-2 py-2 text-left font-semibold">Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {['Box 1', 'Box 2'].map((label) => (
                <tr key={label} className="border-t border-black">
                  <td className="border-r border-black px-2 py-2 font-semibold">{label}</td>
                  <td className="border-r border-black px-2 py-2">&nbsp;</td>
                  <td className="border-r border-black px-2 py-2">&nbsp;</td>
                  <td className="px-2 py-2">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="border border-black">
          <div className="border-b border-black bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">Notes</div>
          <div className="min-h-[96px] whitespace-pre-line px-3 py-3">{notesContent ? notesContent : ' '}</div>
        </section>

        <section className="border border-black">
          <div className="border-b border-black bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            Process Checklist
          </div>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-16 border-r border-black px-2 py-2 text-left font-semibold">Step</th>
                <th className="border-r border-black px-2 py-2 text-left font-semibold">Addon / Operation</th>
                <th className="w-28 px-2 py-2 text-left font-semibold">Planned</th>
              </tr>
            </thead>
            <tbody>
              {sortedAddons.map((addon, idx) => {
                const selected = selectedAddonIds.has(addon.id);
                return (
                  <tr key={addon.id} className="border-t border-black">
                    <td className="border-r border-black px-2 py-2 font-semibold">{formatStepNumber(idx)}</td>
                    <td className={`border-r border-black px-2 py-2 ${selected ? 'font-semibold' : ''}`}>
                      {addon.name}
                    </td>
                    <td className="px-2 py-2">{selected ? '✓' : ''}</td>
                  </tr>
                );
              })}
              {sortedAddons.length === 0 && (
                <tr className="border-t border-black">
                  <td className="border-r border-black px-2 py-2">001</td>
                  <td className="border-r border-black px-2 py-2">No addons configured.</td>
                  <td className="px-2 py-2" />
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="border border-black">
          <div className="border-b border-black bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            Materials Used
          </div>
          <div className="min-h-[48px] px-3 py-3">
            {materialsUsed.length ? (
              <ul className="list-disc pl-4">
                {materialsUsed.map((mat) => (
                  <li key={mat}>{mat}</li>
                ))}
              </ul>
            ) : (
              <span>—</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
