"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/orders?take=50')
      .then(res => {
        if (!res.ok) throw res;
        return res.json();
      })
      .then(data => setItems(data.items ?? []))
      .catch(async (err) => {
        try {
          const json = await err.json();
          setError(JSON.stringify(json));
        } catch {
          setError('Failed to fetch orders');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 min-h-screen bg-[#0B0F14] text-[#E6EDF3]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Orders</h1>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-400">{error}</div>}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="text-left text-[#9FB1C1]">
              <tr>
                <th>Order#</th>
                <th>Customer</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id} className="border-t border-[#16202A]">
                  <td className="py-2"><Link href={`/orders/${o.id}`} className="text-[#34D399] underline">{o.orderNumber}</Link></td>
                  <td>{o.customer?.name ?? '-'}</td>
                  <td>{o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '-'}</td>
                  <td>{o.priority}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
