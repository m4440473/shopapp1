import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavTabs() {
  const path = usePathname() || '';
  return (
    <div className="mb-4">
      <nav className="flex gap-3 text-sm text-[#9FB1C1]">
        <Link href="/admin/users" className={path.startsWith('/admin/users') ? 'text-[#34D399] underline' : ''}>Users</Link>
        <Link href="/admin/materials" className={path.startsWith('/admin/materials') ? 'text-[#34D399] underline' : ''}>Materials</Link>
        <Link href="/admin/vendors" className={path.startsWith('/admin/vendors') ? 'text-[#34D399] underline' : ''}>Vendors</Link>
        <Link href="/admin/checklist" className={path.startsWith('/admin/checklist') ? 'text-[#34D399] underline' : ''}>Checklist</Link>
      </nav>
    </div>
  );
}
