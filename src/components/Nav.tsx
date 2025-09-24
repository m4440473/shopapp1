"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/orders', label: 'Orders' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/admin/users', label: 'Admin' },
];

export default function Nav() {
  const pathname = usePathname() || '/';

  return (
    <nav className="hidden items-center gap-2 rounded-lg bg-muted p-1 text-muted-foreground md:flex">
      {links.map((link) => {
        const active =
          link.href === '/admin/users'
            ? pathname.startsWith('/admin')
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all hover:text-foreground",
              active && 'bg-background text-foreground shadow'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
