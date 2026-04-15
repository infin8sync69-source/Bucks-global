import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';
import { ToastProvider } from '@/components/Toast';
import ClientLayout from '@/components/ClientLayout';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'Bucks Global — Decentralized Social Feed',
  description: 'A censorship-resistant, peer-to-peer social platform built on IPFS. Your identity, your data, your ownership.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://bucks.global'),
  openGraph: {
    title: 'Bucks Global',
    description: 'Decentralized social feed powered by IPFS',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bucks Global',
    description: 'Decentralized social feed powered by IPFS',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${outfit.variable} font-sans bg-transparent text-foreground antialiased`}
      >
        {/* Animated ambient background blobs */}
        <div className="glass-blob-1" />
        <div className="glass-blob-2" />
        <div className="glass-blob-3" />
        <AuthGuard>
          <ToastProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </ToastProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
