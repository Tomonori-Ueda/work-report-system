import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { QueryProviders } from '@/lib/query/providers';
import { AuthProvider } from '@/components/features/auth/auth-provider';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: '作業日報システム',
  description: '建設・製造・物流向け作業報告書（日報）管理システム',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        <QueryProviders>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </QueryProviders>
      </body>
    </html>
  );
}
