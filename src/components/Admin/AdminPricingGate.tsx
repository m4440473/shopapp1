'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

import { canAccessAdmin } from '@/lib/rbac';

interface AdminPricingGateProps {
  initialRole?: string | null;
  initialAdmin?: boolean;
  admin: ReactNode | null;
  fallback: ReactNode;
}

export default function AdminPricingGate({
  initialRole,
  initialAdmin,
  admin,
  fallback,
}: AdminPricingGateProps) {
  const { data } = useSession();
  const sessionUser = data?.user as any;
  const fallbackInput =
    sessionUser ??
    (initialAdmin
      ? { role: initialRole ?? undefined, admin: true }
      : initialRole
      ? { role: initialRole }
      : undefined);
  const canShowAdmin = !!admin && canAccessAdmin(fallbackInput);

  if (canShowAdmin) {
    return <>{admin}</>;
  }

  return <>{fallback}</>;
}
