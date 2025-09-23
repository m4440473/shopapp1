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
        <Nav />
        <div className="pt-4 px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
