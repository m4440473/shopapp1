import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Repeat2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { buildSignInRedirectPath } from '@/lib/auth-redirect';
import { getServerAuthSession } from '@/lib/auth-session';
import { canAccessAdmin } from '@/lib/rbac';
import { listRepeatOrderTemplateSummaries } from '@/modules/repeat-orders/repeat-orders.service';

const formatDate = (value: Date | string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export default async function RepeatOrdersPage() {
  const session = await getServerAuthSession();
  if (!session) redirect(buildSignInRedirectPath('/repeat-orders'));
  if (!canAccessAdmin(session.user as any)) redirect('/403');

  const result = await listRepeatOrderTemplateSummaries({ take: 100 });
  const templates = result.ok ? result.data.items : [];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Repeat2 className="h-4 w-4" /> Repeat Orders
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Customer-part templates</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Start another run of a proven part without rebuilding its manufacturing setup. Each template belongs to one customer and one part.
          </p>
        </div>
      </div>

      {templates.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="h-full">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{template.primaryPartNumber ?? template.name}</CardTitle>
                    <CardDescription>
                      {template.customerName ?? 'Unknown customer'}
                      {template.primaryPartName ? ` · ${template.primaryPartName}` : ''}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{template.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{template.partCount === 1 ? 'One saved part definition' : `${template.partCount} saved part definitions (legacy template)`}</p>
                  <p>Updated {formatDate(template.updatedAt)}</p>
                  {template.sourceOrderId && template.sourceOrderNumber ? (
                    <p>
                      Source:{' '}
                      <Link className="font-medium text-primary hover:underline" href={`/orders/${template.sourceOrderId}`}>
                        order #{template.sourceOrderNumber}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/orders/new?templateId=${template.id}`}>Create again</Link>
                  </Button>
                  {template.customerId ? (
                    <Button asChild variant="outline">
                      <Link href={`/customers/${template.customerId}`}>View customer</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No customer-part templates yet. Open a proven order, select a part, and choose Create again or Save repeat template.
          </CardContent>
        </Card>
      )}
    </main>
  );
}
