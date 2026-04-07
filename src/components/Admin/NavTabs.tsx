"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cog, FileText, Package, ReceiptText, Shapes, Users, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';

const tabGroups = [
  {
    title: 'Overview',
    items: [{ href: '/admin', label: 'Admin Center', icon: FileText }],
  },
  {
    title: 'People',
    items: [{ href: '/admin/users', label: 'Users', icon: Users }],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/materials', label: 'Materials', icon: Package },
      { href: '/admin/vendors', label: 'Vendors', icon: Wrench },
      { href: '/admin/addons', label: 'Add-ons & Checklist', icon: Shapes },
      { href: '/admin/custom-fields', label: 'Custom Fields', icon: Cog },
    ],
  },
  {
    title: 'Quote & Order Ops',
    items: [
      { href: '/orders/new', label: 'Create Order', icon: ReceiptText },
      { href: '/admin/quotes/new', label: 'Create Quote', icon: FileText },
      { href: '/admin/quotes', label: 'View Quotes', icon: FileText },
    ],
  },
];

export default function NavTabs() {
  const path = usePathname() || '';
  return (
    <div className="mb-6">
      <nav className="space-y-2 rounded-lg border border-border bg-muted/40 p-2">
        {tabGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            <div className="flex flex-wrap items-center gap-2">
              {group.items.map((tab) => {
                const active = tab.href === '/admin' ? path === '/admin' : path.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-sm font-medium text-muted-foreground transition-all hover:text-foreground',
                      active && 'border-border bg-background text-foreground shadow'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
