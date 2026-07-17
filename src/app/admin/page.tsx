import Link from 'next/link';
import {
  ArrowRight,
  Cog,
  FileText,
  Package,
  ReceiptText,
  Settings,
  Shapes,
  Users,
  Wrench,
} from 'lucide-react';

import NavTabs from '@/components/Admin/NavTabs';

const shopSetupLinks = [
  {
    href: '/admin/materials',
    label: 'Materials',
    detail: 'Names and specifications used while quoting.',
    icon: Package,
  },
  {
    href: '/admin/vendors',
    label: 'Vendors',
    detail: 'Suppliers for material and outside services.',
    icon: Wrench,
  },
  {
    href: '/admin/addons',
    label: 'Work Steps',
    detail: 'Shop tasks and the rates used to estimate them.',
    icon: Shapes,
  },
];

const systemSetupLinks = [
  {
    href: '/admin/users',
    label: 'Users',
    detail: 'People, access, and shop-screen accounts.',
    icon: Users,
  },
  {
    href: '/admin/templates',
    label: 'Documents',
    detail: 'Quote and order print layouts.',
    icon: FileText,
  },
  {
    href: '/admin/custom-fields',
    label: 'Custom Fields',
    detail: 'Extra information collected on forms.',
    icon: Cog,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    detail: 'Company details, departments, and workflow rules.',
    icon: Settings,
  },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6 p-4 text-neutral-100">
      <NavTabs />

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Admin home</p>
        <h1 className="text-3xl font-semibold">What would you like to do?</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Start a quote, continue one you already saved, or update the shop setup.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/quotes/new"
          className="group flex min-h-36 items-center justify-between gap-4 rounded-xl border-2 border-primary bg-primary/10 p-6 transition hover:bg-primary/15"
        >
          <div className="space-y-2">
            <p className="text-xl font-semibold text-foreground">New Quote</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose a customer, upload drawings, check material, and build the price.
            </p>
          </div>
          <ArrowRight className="h-7 w-7 shrink-0 text-primary transition group-hover:translate-x-1" />
        </Link>

        <Link
          href="/admin/quotes"
          className="group flex min-h-36 items-center justify-between gap-4 rounded-xl border border-border bg-card/70 p-6 transition hover:border-primary/60 hover:bg-card"
        >
          <div className="space-y-2">
            <p className="text-xl font-semibold text-foreground">Resume Quotes</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick up a saved quote, record approval, or turn an approved quote into an order.
            </p>
          </div>
          <ArrowRight className="h-7 w-7 shrink-0 text-primary transition group-hover:translate-x-1" />
        </Link>
      </section>

      <section className="rounded-xl border border-border/80 bg-background/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Emergency or internal job</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Skip quoting only when there is no customer quote to approve.
            </p>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/50"
          >
            <ReceiptText className="h-4 w-4 text-primary" />
            Create direct order
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SetupSection
          heading="Shop setup"
          description="The lists used while estimating and planning work."
          links={shopSetupLinks}
        />
        <SetupSection
          heading="System setup"
          description="Less-frequent company and application settings."
          links={systemSetupLinks}
        />
      </div>
    </div>
  );
}

function SetupSection({
  heading,
  description,
  links,
}: {
  heading: string;
  description: string;
  links: Array<{
    href: string;
    label: string;
    detail: string;
    icon: typeof FileText;
  }>;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <h2 className="text-base font-semibold">{heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/40 p-3 transition hover:border-primary/50 hover:bg-background"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
