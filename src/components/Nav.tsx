"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname() || '/';
  return (
    <header className="bg-[#121821] border-b border-[#0F1720]">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold text-[#E6EDF3]">ShopApp</Link>
          <nav className="hidden md:flex items-center gap-3 text-sm text-[#9FB1C1]">
            <Link href="/orders" className={path.startsWith('/orders') ? 'text-[#34D399] underline' : ''}>Orders</Link>
            <Link href="/orders/new" className={path === '/orders/new' ? 'text-[#34D399] underline' : ''}>New Order</Link>
            <Link href="/admin/users" className={path.startsWith('/admin') ? 'text-[#34D399] underline' : ''}>Admin</Link>
          </nav>
        </div>
        <div className="text-sm">
          <Link href="/auth/signin" className="text-[#9FB1C1] hover:text-[#E6EDF3]">Sign in</Link>
        </div>
      </div>
    </header>
  );
}
