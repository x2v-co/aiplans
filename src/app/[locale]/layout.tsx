'use client';

import '../globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { TranslationsProvider } from '@/lib/translations';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

  const isZh = locale === 'zh';
  const defaultTitle = isZh ? 'aiplans.dev - 全网AI价格对比平台' : 'aiplans.dev - Compare AI Pricing & Save Money';
  const defaultDesc = isZh
    ? '对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格。找到最便宜的 API 渠道，节省高达 70% 成本。'
    : 'Compare GPT-4, Claude, DeepSeek, Gemini pricing. Find cheapest API channels and save up to 70%.';

  return (
    <html lang={locale}>
      <head>
        <title>{defaultTitle}</title>
        <meta name="description" content={defaultDesc} />
        <meta name="keywords" content={isZh ? 'AI价格,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4价格对比' : 'AI pricing,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4 price comparison'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="robots" content="index, follow" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />

        {/* Open Graph */}
        <meta property="og:title" content={defaultTitle} />
        <meta property="og:description" content={defaultDesc} />
        <meta property="og:url" content="https://aiplans.dev" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="aiplans.dev" />
        <meta property="og:locale" content={isZh ? 'zh_CN' : 'en_US'} />
        <meta property="og:image" content="https://aiplans.dev/logo.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={defaultTitle} />
        <meta name="twitter:description" content={defaultDesc} />
        <meta name="twitter:image" content="https://aiplans.dev/logo.png" />

        {/* Alternate links */}
        <link rel="alternate" hrefLang="en" href="https://aiplans.dev/en" />
        <link rel="alternate" hrefLang="zh" href="https://aiplans.dev/zh" />
        <link rel="alternate" hrefLang="x-default" href="https://aiplans.dev" />

        {/* Canonical */}
        <link rel="canonical" href="https://aiplans.dev" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": isZh ? "aiplans.dev - 全网AI价格对比" : "aiplans.dev - AI Pricing Comparison",
              "description": isZh
                ? "对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格"
                : "Compare AI model pricing across providers",
              "url": "https://aiplans.dev",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://aiplans.dev/{search_term_string}"
                },
                "query-input": "required name=search_term_string"
              },
              "inLanguage": isZh ? "zh-CN" : "en-US",
              "publisher": {
                "@type": "Organization",
                "name": "aiplans.dev",
                "url": "https://aiplans.dev"
              }
            })
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Analytics />
        <SpeedInsights />
        <TranslationsProvider messages={messages}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
