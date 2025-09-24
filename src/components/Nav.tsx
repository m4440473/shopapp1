"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname() || '/';
  return (
    <div className="nav-row">
      <nav className="nav-links" aria-label="Primary">
        <Link href="/orders" className={path.startsWith('/orders') ? 'ok nav-link' : 'muted nav-link'}>Orders</Link>
        <Link href="/customers" className={path.startsWith('/customers') ? 'ok nav-link' : 'muted nav-link'}>Customers</Link>
        <Link href="/orders/new" className={path === '/orders/new' ? 'ok nav-link' : 'muted nav-link'}>New Order</Link>
        <Link href="/admin/users" className={path.startsWith('/admin') ? 'ok nav-link' : 'muted nav-link'}>Admin</Link>
      </nav>
      <div className="nav-actions"> <Link href="/auth/signin" className="muted">Sign in</Link></div>
    </div>
  );
}
