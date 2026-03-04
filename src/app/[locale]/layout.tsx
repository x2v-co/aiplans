'use client';

import '../globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { TranslationsProvider } from '@/lib/translations';
import { Analytics } from "@vercel/analytics/next";
import { use, useEffect, useState } from 'react';
import enMessages from '@/../messages/en.json';
import zhMessages from '@/../messages/zh.json';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const messagesMap: Record<string, any> = {
  en: enMessages,
  zh: zhMessages,
};

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const [messages, setMessages] = useState<any>({});

  useEffect(() => {
    setMessages(messagesMap[locale] || enMessages);
  }, [locale]);

  return (
    <html lang={locale}>
      <head>
        <link rel="alternate" hrefLang="en" href="https://aiplans.dev/en" />
        <link rel="alternate" hrefLang="zh" href="https://aiplans.dev/zh" />
        <link rel="alternate" hrefLang="x-default" href="https://aiplans.dev" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Analytics />
        <TranslationsProvider messages={messages}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
