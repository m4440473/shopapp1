import Link from 'next/link';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';

export default async function Home() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Card className="md:col-span-2 xl:col-span-3">
        <CardHeader className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Welcome to ShopApp</CardTitle>
            <CardDescription>
              A unified dashboard for tracking production orders across your shop floor.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            Dark theme powered by shadcn/ui
          </Badge>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/orders">View orders</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/orders/new">Create order</Link>
          </Button>
        </CardFooter>
      </Card>

      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-xl">Your access</CardTitle>
          <CardDescription>Signed-in account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {user ? (
            <>
              <div>
                <span className="font-medium text-foreground">Name:</span> {user.name || user.email}
              </div>
              <div>
                <span className="font-medium text-foreground">Role:</span> {(user as any).role || 'Unknown'}
              </div>
            </>
          ) : (
            <div>
              You&apos;re browsing as a guest. Use the demo credentials to sign in and explore the full workflow.
            </div>
          )}
        </CardContent>
        {!user && (
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/auth/signin">Sign in to continue</Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-xl">Need a tour?</CardTitle>
          <CardDescription>Jump straight to the admin tools to seed catalog data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure machinists, materials, vendors and checklist templates from the admin dashboard before scheduling new work.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/admin/users">Go to admin</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
