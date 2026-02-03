import { format } from 'date-fns';
import { redirect, notFound } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';

import { prisma } from '@/lib/prisma';

function formatDate(input?: Date | string | null) {
  if (!input) return '—';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'PP');
}

type PrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPrintPage({ params }: PrintPageProps) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/customers/${id}/print`);
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          assignedMachinist: { select: { name: true, email: true } },
          parts: { select: { quantity: true } },
        },
        orderBy: [{ receivedDate: 'desc' }],
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const totalOrders = customer.orders.length;
  const activeOrders = customer.orders.filter((order) => order.status !== 'CLOSED');
  const closedOrders = customer.orders.filter((order) => order.status === 'CLOSED');
  const totalParts = customer.orders.reduce((acc, order) => {
    const orderParts = order.parts?.reduce((sum, part) => sum + (part.quantity ?? 0), 0) ?? 0;
    return acc + orderParts;
  }, 0);

  const recentOrders = customer.orders.slice(0, 12).map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    receivedDate: order.receivedDate,
    dueDate: order.dueDate,
    priority: order.priority,
    machinist: order.assignedMachinist?.name ?? order.assignedMachinist?.email ?? 'Unassigned',
    partsCount: order.parts?.reduce((sum, part) => sum + (part.quantity ?? 0), 0) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-white p-8 text-sm text-black print:p-6">
      <header className="flex flex-col gap-4 border-b border-gray-300 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sterling Tool and Die</h1>
          <p className="text-base font-medium">Customer summary</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{customer.name}</p>
          <p className="text-gray-600">Report generated {formatDate(new Date())}</p>
        </div>
      </header>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-gray-500">Primary contact</p>
            <p className="font-medium">{customer.contact ?? 'Not provided'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Phone</p>
            <p className="font-medium">{customer.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Email</p>
            <p className="font-medium">{customer.email ?? '—'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase text-gray-500">Address</p>
            <p className="whitespace-pre-line font-medium">{customer.address ?? '—'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Production snapshot</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs uppercase text-gray-500">Total orders</p>
            <p className="text-lg font-semibold">{totalOrders}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs uppercase text-gray-500">Active orders</p>
            <p className="text-lg font-semibold">{activeOrders.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs uppercase text-gray-500">Completed orders</p>
            <p className="text-lg font-semibold">{closedOrders.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs uppercase text-gray-500">Parts produced</p>
            <p className="text-lg font-semibold">{totalParts}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border border-gray-300 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <p className="text-xs uppercase text-gray-500">
            Showing last {recentOrders.length} of {totalOrders} total orders
          </p>
        </div>
        <table className="w-full table-fixed border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="w-[120px] py-2 font-medium uppercase tracking-wide text-gray-500">Order</th>
              <th className="w-[120px] py-2 font-medium uppercase tracking-wide text-gray-500">Status</th>
              <th className="w-[120px] py-2 font-medium uppercase tracking-wide text-gray-500">Received</th>
              <th className="w-[120px] py-2 font-medium uppercase tracking-wide text-gray-500">Due</th>
              <th className="w-[80px] py-2 font-medium uppercase tracking-wide text-gray-500">Priority</th>
              <th className="py-2 font-medium uppercase tracking-wide text-gray-500">Machinist</th>
              <th className="w-[80px] py-2 font-medium uppercase tracking-wide text-gray-500 text-right">Parts</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id} className="border-b border-gray-200">
                <td className="py-2 font-semibold">#{order.orderNumber}</td>
                <td className="py-2">{order.status.replace(/_/g, ' ')}</td>
                <td className="py-2">{formatDate(order.receivedDate)}</td>
                <td className="py-2">{formatDate(order.dueDate)}</td>
                <td className="py-2">{order.priority}</td>
                <td className="py-2">{order.machinist}</td>
                <td className="py-2 text-right">{order.partsCount}</td>
              </tr>
            ))}
            {!recentOrders.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  No orders recorded for this customer yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="text-center text-xs uppercase tracking-[0.3em] text-gray-500">
        Sterling Tool and Die • Customer summary generated by ShopApp
      </footer>
    </div>
  );
}
