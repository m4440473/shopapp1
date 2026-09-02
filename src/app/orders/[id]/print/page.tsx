import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { OrderTravelerControls } from '@/components/print/OrderTravelerControls';
import { OrderTravelerDocument } from '@/components/print/OrderTravelerDocument';
import { getAppSettings } from '@/lib/app-settings';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import { getServerAuthSession } from '@/lib/auth-session';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import { buildOrderTraveler } from '@/modules/orders/order-traveler';

export default async function OrderTravelerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session) {
    redirect(buildSignInRedirectPath(`/orders/${id}/print`));
  }

  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  const cookie = headerStore.get('cookie') ?? '';
  const baseUrl = host ? `${protocol}://${host}` : '';

  const [response, settings] = await Promise.all([
    fetch(`${baseUrl}/api/orders/${encodeURIComponent(id)}/print-data`, {
      headers: { cookie },
      cache: 'no-store',
    }),
    getAppSettings(),
  ]);

  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Failed to load order traveler data');

  const payload = await response.json();
  if (!payload?.order) notFound();

  const safeOrder = sanitizePricingForNonAdmin(payload.order);
  const traveler = buildOrderTraveler(safeOrder);

  return (
    <div className="mx-auto max-w-[8.5in]">
      <OrderTravelerControls orderId={id} />
      <OrderTravelerDocument traveler={traveler} companyName={settings.companyName} />
    </div>
  );
}
