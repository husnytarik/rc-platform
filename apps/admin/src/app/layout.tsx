import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'RoasteryClub Yönetim',
  description: 'Üretici sipariş, üretim ve müşteri yönetim paneli',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
