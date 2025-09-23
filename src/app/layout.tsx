import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'ShopApp',
  description: 'Machine shop order tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B0F14] text-[#E6EDF3] min-h-screen">
        <header className="app-header">
          <div className="container px-4 py-4">
            <Nav />
          </div>
        </header>
        <main className="app-main container px-4">
          {children}
        </main>
      </body>
    </html>
  );
}
