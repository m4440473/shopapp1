"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Shop Floor Intelligence' },
  { href: '/orders', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/admin/users', label: 'Admin' },
];

export default function Nav() {
  const pathname = usePathname() || '/';

  return (
    <nav className="hidden items-center gap-3 text-sm font-medium text-muted-foreground md:flex">
      {links.map((link, index) => {
        const active =
          link.href === '/admin/users'
            ? pathname.startsWith('/admin')
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <div key={link.href} className="flex items-center gap-3">
            <Link
              href={link.href}
              className={cn(
                'transition-colors hover:text-primary',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
            {index < links.length - 1 && <span className="text-muted-foreground/60">|</span>}
          </div>
        );
      })}
    </nav>
  );
}
