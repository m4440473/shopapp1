"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname() || '/';
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:8}}>
      <nav style={{display:'flex',gap:12,alignItems:'center'}} aria-label="Primary">
        <Link href="/orders" className={path.startsWith('/orders') ? 'ok' : 'muted'}>Orders</Link>
        <Link href="/orders/new" className={path === '/orders/new' ? 'ok' : 'muted'}>New Order</Link>
        <Link href="/admin/users" className={path.startsWith('/admin') ? 'ok' : 'muted'}>Admin</Link>
      </nav>
      <div className="muted"> <Link href="/auth/signin" className="muted">Sign in</Link></div>
    </div>
  );
}
