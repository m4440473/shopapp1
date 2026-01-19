import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getAppSettings } from '@/lib/app-settings';

const FEATURES = [
  'Centralized quotes, orders, and approvals to eliminate paper trails.',
  'Attachment storage for POs, drawings, inspection docs, and photos.',
  'Checklist-driven workflows for machining, coating, and delivery.',
  'Real-time order visibility for the shop floor and front office.',
  'Invoice templates tuned for machine shop quoting and billing.',
];

const SCREENSHOTS = [
  { key: 'dashboard', title: 'Dashboard overview', file: '/landing/dashboard.svg' },
  { key: 'orders', title: 'Order tracking', file: '/landing/orders.svg' },
  { key: 'quotes', title: 'Quote details', file: '/landing/quotes.svg' },
  { key: 'approvals', title: 'Approval inbox', file: '/landing/approvals.svg' },
  { key: 'invoices', title: 'Invoice templates', file: '/landing/invoices.svg' },
  { key: 'settings', title: 'Settings control', file: '/landing/settings.svg' },
];

export default async function AboutPage() {
  const settings = await getAppSettings();

  return (
    <div className="space-y-12">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/80">ShopApp overview</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            A focused, single-tenant operations hub for machine shops.
          </h1>
          <p className="text-base text-muted-foreground">
            {settings.companyName} runs ShopApp locally to keep quote approvals, production orders, and attachments in one
            secure place. It replaces spreadsheets with a workflow that the front office and shop floor can trust.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="rounded-full">
              <Link href="/auth/signin">Go to dashboard</Link>
            </Button>
          </div>
        </div>
        <Card className="border border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">What ShopApp does</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              ShopApp tracks the entire journey from quote request to final invoice. Every order retains its approvals,
              attachments, and checklists so nothing falls through the cracks.
            </p>
            <p>
              Because it is installed locally for a single shop, all data stays onsite and can be tuned to your specific
              workflow rules.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Problems solved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Stop chasing down paper approvals and buried emails. ShopApp keeps every quote, order, and attachment tied
              together so production can start faster and audits are painless.
            </p>
            <p>
              Built-in status tracking, checklists, and attachment storage give machinists the context they need without
              hunting for files.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Screenshots</h2>
          <p className="text-sm text-muted-foreground">
            Visual snapshots of the core workflows used daily by {settings.companyName}.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SCREENSHOTS.map((shot) => (
            <Card key={shot.key} className="overflow-hidden border border-border/60">
              <div className="relative h-40 bg-muted/40">
                <Image
                  src={shot.file}
                  alt={shot.title}
                  fill
                  sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <CardContent className="py-3 text-sm font-medium text-foreground">{shot.title}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-primary/10 p-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground">Ready to run your shop on one system?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access the dashboard, quote approvals, and the latest production orders.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/auth/signin">Sign in</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="rounded-full">
            <Link href="/auth/signin">Open dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
