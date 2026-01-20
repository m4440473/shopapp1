"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/materials', label: 'Materials' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/addons', label: 'Add-ons & Checklist' },
  { href: '/admin/custom-fields', label: 'Custom Fields' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function NavTabs() {
  const path = usePathname() || '';
  return (
    <div className="mb-6">
      <nav className="flex w-full items-center gap-2 rounded-lg bg-muted p-1 text-muted-foreground">
        {tabs.map((tab) => {
          const active = path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all hover:text-foreground',
                active && 'bg-background text-foreground shadow'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
