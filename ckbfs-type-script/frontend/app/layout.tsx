import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/utils/toast';
import { WalletProvider } from '@/context/WalletContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CKBFS — CKB File Storage System',
  description: 'Decentralized file storage on CKB blockchain · Aggron4 Testnet',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable} style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <ToastProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
