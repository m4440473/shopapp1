import Link from 'next/link';

import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Access denied</p>
      <h1 className="text-3xl font-semibold text-foreground">Not authorized</h1>
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view this admin area. If you believe this is a mistake, contact an administrator.
      </p>
      <Button asChild className="rounded-full">
        <Link href="/">Return to dashboard</Link>
      </Button>
    </div>
  );
}
