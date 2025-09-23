import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'ShopApp',
  description: 'Machine shop order tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <div className="container">
            <div style={{display:'flex',alignItems:'baseline',gap:12}}>
              <h1>ShopApp</h1>
              <div className="sub">Machine shop order tracking • Demo</div>
            </div>
            <Nav />
          </div>
        </header>
        <main>
          <div className="container app-main">
            {children}
          </div>
        </main>
        <footer className="container">
          <div style={{padding:'16px 0',textAlign:'center',color:'var(--muted)'}}>Demo • built with ❤️</div>
        </footer>
      </body>
    </html>
  );
}
