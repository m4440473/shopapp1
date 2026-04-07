import Link from 'next/link';
import {
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

const sections = [
  {
    heading: 'People & Access',
    description: 'Control users, permissions, and login-facing account setup.',
    links: [
      {
        href: '/admin/users',
        label: 'Users',
        detail: 'Manage admins, machinists, and viewers.',
        icon: Users,
      },
    ],
  },
  {
    heading: 'Catalog & Workflow',
    description: 'Define core data the shop relies on for quoting and production.',
    links: [
      {
        href: '/admin/materials',
        label: 'Materials',
        detail: 'Maintain stock material names and specs.',
        icon: Package,
      },
      {
        href: '/admin/vendors',
        label: 'Vendors',
        detail: 'Set approved suppliers for purchasing and quote links.',
        icon: Wrench,
      },
      {
        href: '/admin/addons',
        label: 'Add-ons & Checklist',
        detail: 'Configure labor/add-on rates and checklist templates.',
        icon: Shapes,
      },
      {
        href: '/admin/custom-fields',
        label: 'Custom Fields',
        detail: 'Extend order and quote forms without code edits.',
        icon: Cog,
      },
    ],
  },
  {
    heading: 'Quote & Order Ops',
    description: 'Launch the core document workflows.',
    links: [
      {
        href: '/orders/new',
        label: 'Create Order',
        detail: 'Start a production order.',
        icon: ReceiptText,
      },
      {
        href: '/admin/quotes/new',
        label: 'Create Quote',
        detail: 'Start a new customer quote.',
        icon: FileText,
      },
    ],
  },
  {
    heading: 'Business Settings',
    description: 'Branding, templates, and system-wide defaults.',
    links: [
      {
        href: '/admin/templates',
        label: 'Templates',
        detail: 'Manage document template layouts.',
        icon: FileText,
      },
      {
        href: '/admin/settings',
        label: 'Settings',
        detail: 'Update company identity and shop defaults.',
        icon: Settings,
      },
    ],
  },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6 p-4 text-neutral-100">
      <NavTabs />
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Admin Center</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Use this page as the control room for user access, shop configuration, and quote/document setup.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.heading} className="rounded-xl border border-border bg-card/60 p-4">
            <h2 className="text-base font-semibold">{section.heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            <div className="mt-3 space-y-2">
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/40 p-3 transition hover:border-primary/50 hover:bg-background"
                  >
                    <Icon className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.detail}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Need broader process updates? Pair configuration edits with notes in continuity docs so workflow intent stays clear.
      </p>
    </div>
  );
}
