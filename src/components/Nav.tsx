"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname() || '/';
  return (
    <header className="app-header" role="banner">
      <div className="container flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold text-[#E6EDF3]">ShopApp</Link>
          <nav className="hidden md:flex items-center gap-3 text-sm muted" aria-label="Primary">
            <Link href="/orders" className={path.startsWith('/orders') ? 'text-[#34D399] underline' : ''}>Orders</Link>
            <Link href="/orders/new" className={path === '/orders/new' ? 'text-[#34D399] underline' : ''}>New Order</Link>
            <Link href="/admin/users" className={path.startsWith('/admin') ? 'text-[#34D399] underline' : ''}>Admin</Link>
          </nav>
        </div>
        <div className="text-sm">
          <Link href="/auth/signin" className="muted hover:text-[#E6EDF3]">Sign in</Link>
        </div>
      </div>
    </header>
  );
}
