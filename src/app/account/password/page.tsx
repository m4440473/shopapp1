import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-session';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';

import { ToastProvider } from '@/components/ui/Toast';
import PasswordClient from './client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(buildSignInRedirectPath('/account/password'));
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 text-foreground">
      <div>
        <h1 className="text-2xl font-semibold">Account security</h1>
        <p className="text-sm text-muted-foreground">
          Set or reset your password. Passwords must be at least 8 characters long.
        </p>
      </div>
      <ToastProvider>
        <PasswordClient />
      </ToastProvider>
    </div>
  );
}
