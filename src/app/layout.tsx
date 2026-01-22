import './globals.css';
import { Roboto } from 'next/font/google';

import AppNav from '@/components/AppNav';
import Providers from '@/components/Providers';
import { buildThemeVars, getAppSettings } from '@/lib/app-settings';
import { getInitials } from '@/lib/get-initials';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'ShopApp',
  description: 'Sterling Tool and Die order tracking',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAppSettings();
  const themeVars = buildThemeVars(settings);
  const initials = getInitials(settings.companyName);
  const logoUrl = settings.logoPath ? '/branding/logo' : null;

  return (
    <html
      lang="en"
      className={`dark ${roboto.variable}`}
      style={themeVars as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen w-full flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-6 border-b border-border/60 bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/50 md:px-8">
              <AppNav companyName={settings.companyName} initials={initials} logoUrl={logoUrl} />
            </header>
            <main className="flex-1">
              <div className="container py-10">{children}</div>
            </main>
            <footer className="border-t border-border/60 bg-background/80 py-6 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {settings.companyName} - built with care
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
