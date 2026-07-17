'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, Package, Settings, Shapes, Users, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin', label: 'Admin Home', icon: Home, exact: true },
  { href: '/admin/quotes', label: 'Quotes', icon: FileText },
  { href: '/admin/materials', label: 'Materials', icon: Package },
  { href: '/admin/vendors', label: 'Vendors', icon: Wrench },
  { href: '/admin/addons', label: 'Work Steps', icon: Shapes },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function NavTabs() {
  const path = usePathname() || '';

  return (
    <nav
      aria-label="Admin navigation"
      className="mb-6 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1.5"
    >
      {tabs.map((tab) => {
        const active = tab.exact ? path === tab.href : path.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground',
              active && 'bg-background text-foreground shadow-sm',
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
