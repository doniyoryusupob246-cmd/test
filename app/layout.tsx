import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { HeadTitle } from '@/components/shared/head-title';
import Script from 'next/script';

const montserrat = Montserrat({
  variable: '--font-montserrat-sans',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  title: 'MyProperty — поиск недвижимости',
  description: 'Telegram Mini App для поиска квартир и домов в аренду и на продажу',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${montserrat.variable} antialiased`}>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <HeadTitle />
        {children}
      </body>
    </html>
  );
}
