import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function statusColor(status: string) {
  const map: Record<string, string> = {
    RECEIVED: '#6B7280',
    PROGRAMMING: '#60A5FA',
    SETUP: '#22D3EE',
    RUNNING: '#34D399',
    FINISHING: '#F59E0B',
    DONE_MACHINING: '#A78BFA',
    INSPECTION: '#F97316',
    SHIPPING: '#EAB308',
    CLOSED: '#10B981',
  };
  return map[status] ?? '#64748B';
}

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/auth/signin');
  }

  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      orders: {
        orderBy: { receivedDate: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          receivedDate: true,
          dueDate: true,
          status: true,
          priority: true,
        },
      },
    },
  });

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-semibold">Customers</h1>
          <div className="text-sm text-[#9FB1C1]">{customers.length} customers</div>
        </div>

        <div className="mt-4 space-y-4">
          {customers.length === 0 ? (
            <div className="text-sm text-[#9FB1C1]">No customers recorded yet.</div>
          ) : (
            customers.map((customer) => {
              const detailParts = [
                customer.contact ? `Contact: ${customer.contact}` : null,
                customer.email ?? null,
                customer.phone ?? null,
              ].filter(Boolean) as string[];

              return (
                <div
                  key={customer.id}
                  className="bg-[rgba(18,24,33,0.6)] p-4 rounded border border-[rgba(255,255,255,0.04)] shadow-sm"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-medium text-[#E6EDF3]">{customer.name || 'Untitled customer'}</div>
                      <div className="text-sm text-[#9FB1C1]">
                        {detailParts.length ? detailParts.join(' • ') : 'No contact details'}
                      </div>
                    </div>
                    <div className="text-sm text-[#9FB1C1]">Orders: {customer.orders.length}</div>
                  </div>

                  {customer.orders.length ? (
                    <details className="mt-3" open={customer.orders.length <= 3}>
                      <summary>View orders ({customer.orders.length})</summary>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-[#9FB1C1] border-b border-[rgba(255,255,255,0.06)]">
                              <th className="py-2 pr-3">Order #</th>
                              <th className="py-2 pr-3">Received</th>
                              <th className="py-2 pr-3">Due</th>
                              <th className="py-2 pr-3">Priority</th>
                              <th className="py-2 pr-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customer.orders.map((order) => (
                              <tr key={order.id} className="border-b border-[rgba(255,255,255,0.04)]">
                                <td className="py-3 pr-3">
                                  <Link href={`/orders/${order.id}`} className="text-[#34D399] font-medium">
                                    {order.orderNumber}
                                  </Link>
                                </td>
                                <td className="py-3 pr-3">
                                  {order.receivedDate ? new Date(order.receivedDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-3 pr-3">
                                  {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-3 pr-3">{order.priority}</td>
                                <td className="py-3 pr-3">
                                  <span
                                    style={{ background: statusColor(order.status) }}
                                    className="text-black px-2 py-1 rounded text-xs font-semibold inline-block"
                                  >
                                    {order.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ) : (
                    <div className="text-sm text-[#9FB1C1] mt-3">No orders yet.</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
