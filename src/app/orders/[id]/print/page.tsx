import { format } from 'date-fns';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function formatDate(input?: string | Date | null, withTime = false) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, withTime ? 'PPpp' : 'PP');
}

export default async function OrderPrintPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/orders/${params.id}/print`);
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      assignedMachinist: true,
      vendor: true,
      parts: { include: { material: true } },
      checklist: { include: { checklistItem: true } },
      attachments: true,
      notes: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-white p-8 text-sm text-black print:p-6">
      <header className="flex flex-col gap-4 border-b border-gray-300 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sterling Tool and Die</h1>
          <p className="text-base font-medium">ShopApp Work Order</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">Order #{order.orderNumber}</p>
          <p className="text-gray-600">Status: {order.status.replace(/_/g, ' ')}</p>
          <p className="text-gray-600">Due: {formatDate(order.dueDate)}</p>
        </div>
      </header>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Job summary</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-gray-500">Received</p>
            <p className="font-medium">{formatDate(order.receivedDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Priority</p>
            <p className="font-medium">{order.priority}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Machinist</p>
            <p className="font-medium">
              {order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">PO Number</p>
            <p className="font-medium">{order.poNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Vendor</p>
            <p className="font-medium">{order.vendor?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Material status</p>
            <p className="font-medium">
              {order.materialNeeded ? (order.materialOrdered ? 'Ordered / On hand' : 'Needed') : 'Not required'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Model included</p>
            <p className="font-medium">{order.modelIncluded ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Customer</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-gray-500">Name</p>
            <p className="font-medium">{order.customer?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Contact</p>
            <p className="font-medium">{order.customer?.contact ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Phone</p>
            <p className="font-medium">{order.customer?.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Email</p>
            <p className="font-medium">{order.customer?.email ?? '—'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase text-gray-500">Address</p>
            <p className="whitespace-pre-line font-medium">{order.customer?.address ?? '—'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Parts</h2>
          <p className="text-xs uppercase text-gray-500">Total parts: {order.parts.length}</p>
        </div>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="w-1/4 py-2 text-xs uppercase text-gray-500">Part #</th>
              <th className="w-1/6 py-2 text-xs uppercase text-gray-500">Qty</th>
              <th className="w-1/4 py-2 text-xs uppercase text-gray-500">Material</th>
              <th className="py-2 text-xs uppercase text-gray-500">Notes</th>
            </tr>
          </thead>
          <tbody>
            {order.parts.map((part) => (
              <tr key={part.id} className="border-b border-gray-200 align-top">
                <td className="py-2 font-medium">{part.partNumber}</td>
                <td className="py-2">{part.quantity}</td>
                <td className="py-2">{part.material?.name ?? '—'}</td>
                <td className="py-2">{part.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Checklist</h2>
        {order.checklist.length ? (
          <ul className="space-y-2">
            {order.checklist.map((item) => (
              <li key={item.id} className="flex items-center justify-between border border-gray-200 px-3 py-2">
                <span className="font-medium">{item.checklistItem?.label ?? 'Checklist item'}</span>
                <span className="text-xs uppercase text-gray-500">
                  Updated {formatDate(item.updatedAt, true)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No checklist items recorded for this order.</p>
        )}
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Attachments</h2>
        {order.attachments.length ? (
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-left">
                <th className="w-1/3 py-2 text-xs uppercase text-gray-500">Label</th>
                <th className="w-1/3 py-2 text-xs uppercase text-gray-500">Type</th>
                <th className="py-2 text-xs uppercase text-gray-500">Link</th>
              </tr>
            </thead>
            <tbody>
              {order.attachments.map((att) => (
                <tr key={att.id} className="border-b border-gray-200 align-top">
                  <td className="py-2 font-medium">{att.label ?? 'Attachment'}</td>
                  <td className="py-2">{att.mimeType ?? '—'}</td>
                  <td className="py-2 break-words text-blue-700">
                    {att.url}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-600">No attachments on file.</p>
        )}
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Notes</h2>
        {order.notes.length ? (
          <ul className="space-y-3">
            {order.notes.map((note) => (
              <li key={note.id} className="border border-gray-200 p-3">
                <div className="flex items-center justify-between text-xs uppercase text-gray-500">
                  <span>{note.user?.name ?? 'Unknown'}</span>
                  <span>{formatDate(note.createdAt, true)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{note.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No notes recorded.</p>
        )}
      </section>
    </div>
  );
}
