import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import PasswordClient from './client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/auth/signin');
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
