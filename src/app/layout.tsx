import './globals.css';
import Link from 'next/link';
import { Search } from 'lucide-react';

import Nav from '@/components/Nav';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export const metadata = {
  title: 'ShopApp',
  description: 'Machine shop order tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                SA
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Machine shop</p>
                <h1 className="text-lg font-semibold leading-none">ShopApp</h1>
              </div>
            </Link>
            <Nav />
            <div className="relative ml-auto hidden w-full max-w-xs md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search orders" className="pl-8" aria-label="Search orders" />
            </div>
            <Button asChild variant="ghost" className="text-sm">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          </header>
          <main className="flex-1">
            <div className="container py-6 md:py-10">{children}</div>
          </main>
          <footer className="border-t bg-background py-6 text-center text-sm text-muted-foreground">
            Demo • built with ❤️
          </footer>
        </div>
      </body>
    </html>
  );
}
