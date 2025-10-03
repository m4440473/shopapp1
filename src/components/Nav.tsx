"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { canAccessAdmin } from '@/lib/rbac';

type NavLink = { href: string; label: string };

const baseLinks: NavLink[] = [
  { href: '/', label: 'Shop Floor Intelligence' },
  { href: '/orders', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/orders/new', label: 'New Order' },
];

export default function Nav() {
  const pathname = usePathname() || '/';
  const [user, setUser] = React.useState<{ id?: string; role?: string; admin?: boolean } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/whoami', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setUser({ id: data.id, role: data.role, admin: data.admin });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const links = React.useMemo<NavLink[]>(() => {
    const items = [...baseLinks];
    if (user?.role === 'MACHINIST' || user?.role === 'ADMIN') {
      if (user?.id) {
        items.push({ href: `/machinists/${user.id}`, label: 'Machinist Profile' });
      }
    }
    if (user) {
      items.push({ href: '/account/password', label: 'Account' });
    }
    if (user && canAccessAdmin(user)) {
      items.push({ href: '/admin/users', label: 'Admin' });
    }
    return items;
  }, [user]);

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
