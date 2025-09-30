'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

import { canAccessAdmin } from '@/lib/rbac';

interface AdminPricingGateProps {
  initialRole?: string | null;
  admin: ReactNode | null;
  fallback: ReactNode;
}

export default function AdminPricingGate({
  initialRole,
  admin,
  fallback,
}: AdminPricingGateProps) {
  const { data } = useSession();
  const sessionRole = (data?.user as any)?.role ?? initialRole ?? undefined;
  const canShowAdmin = !!admin && canAccessAdmin(sessionRole);

  if (canShowAdmin) {
    return <>{admin}</>;
  }

  return <>{fallback}</>;
}
