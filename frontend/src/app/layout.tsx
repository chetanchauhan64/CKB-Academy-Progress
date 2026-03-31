import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import NotificationToasts from '@/components/NotificationToasts';
import TopProgressBar from '@/components/TopProgressBar';
import { WalletProvider } from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'ChainPress — Decentralized Publishing on CKBFS',
  description:
    'A decentralized WordPress-style publishing platform built on Nervos CKB. Write, version, fork, and transfer blog posts stored permanently in CKBFS witnesses.',
  keywords: ['CKBFS', 'Nervos CKB', 'decentralized publishing', 'blockchain blog', 'Web3 writing'],
  openGraph: {
    title: 'ChainPress',
    description: 'Decentralized publishing on CKBFS',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <WalletProvider>
          {/* Route-change progress bar */}
          <TopProgressBar />

          <div className="app-container">
            <Header />
            <main>{children}</main>

            {/* Site-wide footer */}
            <footer className="site-footer" aria-label="Site footer">
              <span>Built on</span>
              <a href="https://nervos.org" target="_blank" rel="noopener noreferrer">Nervos CKB</a>
              <span className="footer-dot" />
              <span>Powered by</span>
              <a href="https://github.com/ckbfs" target="_blank" rel="noopener noreferrer">CKBFS Protocol</a>
              <span className="footer-dot" />
              <span>⛓ ChainPress</span>
            </footer>
          </div>

          <NotificationToasts />
        </WalletProvider>
      </body>
    </html>
  );
}
