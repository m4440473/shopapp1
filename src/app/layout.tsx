import './globals.css';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Roboto } from 'next/font/google';

import Nav from '@/components/Nav';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'ShopApp',
  description: 'Machine shop order tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${roboto.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-6 border-b border-border/60 bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/50 md:px-8">
            <Link href="/" className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/90 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/30">
                SA
              </div>
              <div className="hidden sm:block">
                <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">Machine Shop</p>
                <h1 className="text-xl font-semibold text-foreground">ShopApp</h1>
              </div>
            </Link>
            <Nav />
            <div className="relative ml-auto hidden w-full max-w-sm md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search orders..."
                className="h-10 rounded-full border-border/60 bg-secondary/40 pl-10 text-sm placeholder:text-muted-foreground/80"
                aria-label="Search orders"
              />
            </div>
            <Button asChild variant="secondary" className="rounded-full border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/20">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          </header>
          <main className="flex-1">
            <div className="container py-10">{children}</div>
          </main>
          <footer className="border-t border-border/60 bg-background/80 py-6 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Demo • built with ❤️
          </footer>
        </div>
      </body>
    </html>
  );
}
