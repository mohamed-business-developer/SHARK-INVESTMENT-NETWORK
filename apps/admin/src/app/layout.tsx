import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { getAdminDirection, getAdminTranslations } from '@/i18n/catalog';
import { resolveServerLocale } from '@/i18n/server';
import { ToastProvider } from '@/components/ui';
import './globals.css';

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const translations = getAdminTranslations(locale);
  return {
    title: translations.meta.title,
    description: translations.meta.description,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await resolveServerLocale();
  const direction = getAdminDirection(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${ibmPlexSansArabic.variable} ${inter.variable}`}
    >
      <body className="min-h-screen antialiased">
        <LocaleProvider initialLocale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
