'use client';

import '../globals.css';
import localFont from "next/font/local";
import { TranslationsProvider } from '@/lib/translations';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { use, useEffect, useState } from 'react';
import enMessages from '@/../messages/en.json';
import zhMessages from '@/../messages/zh.json';

const geistSans = localFont({
  src: [
    { path: "../../../public/fonts/Geist-Regular.woff2", weight: "400" },
    { path: "../../../public/fonts/Geist-Medium.woff2", weight: "500" },
    { path: "../../../public/fonts/Geist-Bold.woff2", weight: "700" },
  ],
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: [
    { path: "../../../public/fonts/GeistMono-Regular.woff2", weight: "400" },
    { path: "../../../public/fonts/GeistMono-Medium.woff2", weight: "500" },
  ],
  variable: "--font-geist-mono",
});

const messagesMap: Record<string, any> = {
  en: enMessages,
  zh: zhMessages,
};

// Page metadata for SEO
const pageMetadata: Record<string, { title: string; description: string }> = {
  en: {
    title: 'aiplans.dev - Compare AI Pricing & Save Money',
    description: 'Compare GPT-4, Claude, DeepSeek, Gemini pricing. Find cheapest API channels and save up to 70%.',
  },
  zh: {
    title: 'aiplans.dev - 全网AI价格对比平台',
    description: '对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格。找到最便宜的 API 渠道，节省高达 70% 成本。',
  },
};

// Generate dynamic metadata based on current route
function generateMetadata(locale: string, pathname: string) {
  const isZh = locale === 'zh';
  const baseMeta = pageMetadata[locale] || pageMetadata.en;

  // Customize title/description based on route
  let title = baseMeta.title;
  let description = baseMeta.description;

  if (pathname.includes('api-pricing')) {
    title = isZh
      ? 'API 价格对比 | 全网最便宜的 AI API 渠道'
      : 'API Pricing Comparison | Cheapest AI API Channels';
    description = isZh
      ? '对比 Claude、GPT-4、DeepSeek 等模型在不同渠道的 API 价格，找最便宜的供应商。'
      : 'Compare Claude, GPT-4, DeepSeek API prices across providers. Find the cheapest channel.';
  } else if (pathname.includes('compare/plans')) {
    title = isZh
      ? 'AI 订阅套餐对比 | ChatGPT Plus vs Claude Pro'
      : 'AI Plan Comparison | ChatGPT Plus vs Claude Pro';
    description = isZh
      ? '对比主流 AI 订阅套餐，找到最适合你的方案。'
      : 'Compare top AI subscription plans. Find the best plan for your needs.';
  } else if (pathname.includes('coupons')) {
    title = isZh
      ? 'AI 优惠码 | 折扣码汇总'
      : 'AI Coupons & Discount Codes';
    description = isZh
      ? '分享和发现 AI 服务的优惠码、折扣码。'
      : 'Discover and share AI service discount codes and coupons.';
  }

  return { title, description };
}

// FAQ data for structured data
type FAQItem = { question: string; answer: string };
type FAQData = Record<string, Record<string, FAQItem[]>>;

const faqData: FAQData = {
  'api-pricing': {
    en: [
      { question: 'What is the cheapest GPT-4 API provider?', answer: 'The cheapest GPT-4 API provider varies by region. Generally, Chinese providers like SiliconFlow and Volcano Engine offer competitive pricing, often 30-50% lower than official OpenAI pricing.' },
      { question: 'How to compare AI API prices across different providers?', answer: 'You can use aiplans.dev to compare AI API prices across providers. We track prices from official APIs, cloud providers, and aggregators in real-time.' },
      { question: 'Which AI API is best for China access?', answer: 'For China access, we recommend domestic providers like Zhipu AI, Qwen, Kimi, or Hunyuan. Some international providers like OpenRouter also work in China via proxy.' }
    ],
    zh: [
      { question: '哪个 GPT-4 API 提供商最便宜？', answer: '最便宜的 GPT-4 API 提供商因地区而异。一般来说，国内提供商如硅基流动和火山引擎提供有竞争力的价格，通常比官方价格低 30-50%。' },
      { question: '如何比较不同提供商的 AI API 价格？', answer: '您可以使用 aiplans.dev 比较不同提供商的 AI API 价格。我们实时追踪官方 API、云提供商和聚合平台的价格。' },
      { question: '哪个 AI API 最适合国内访问？', answer: '对于国内访问，我们推荐智谱AI、通义千问、Kimi 或混元等国内提供商。' }
    ]
  },
  'compare/plans': {
    en: [
      { question: 'What is the best AI subscription plan?', answer: 'The best AI subscription plan depends on your usage. For heavy users, ChatGPT Pro or Claude Pro offer unlimited access. For light users, free tiers or Plus plans are sufficient.' },
      { question: 'Is Claude Pro better than ChatGPT Plus?', answer: 'Claude Pro and ChatGPT Plus excel in different areas. Claude often performs better at coding and long-form writing, while ChatGPT is better at general conversation and plugin ecosystem.' }
    ],
    zh: [
      { question: '最好的 AI 订阅套餐是什么？', answer: '最好的 AI 订阅套餐取决于您的使用量。对于重度用户，ChatGPT Pro 或 Claude Pro 提供无限访问。对于轻度用户，免费版本或 Plus 套餐就足够了。' },
      { question: 'Claude Pro 比 ChatGPT Plus 更好吗？', answer: 'Claude Pro 和 ChatGPT Plus 在不同方面表现出色。Claude 通常在编程和长篇写作方面表现更好，而 ChatGPT 在一般对话和插件生态系统方面更好。' }
    ]
  }
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
  const [pathname, setPathname] = useState('/');

  useEffect(() => {
    setMessages(messagesMap[locale] || enMessages);
    // Get current pathname for metadata
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname.replace(`/${locale}`, '') || '/');
    }
  }, [locale]);

  const isZh = locale === 'zh';
  const { title, description } = generateMetadata(locale, pathname);
  const canonicalUrl = `https://aiplans.dev/${locale}${pathname === '/' ? '' : pathname}`;

  return (
    <html lang={locale}>
      <head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={isZh ? 'AI价格,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4价格对比,API价格对比' : 'AI pricing,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4 price comparison,API pricing comparison'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="robots" content="index, follow" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="aiplans.dev" />
        <meta property="og:locale" content={isZh ? 'zh_CN' : 'en_US'} />
        <meta property="og:image" content="https://aiplans.dev/logo.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://aiplans.dev/logo.png" />

        {/* Alternate links - Hreflang for i18n SEO */}
        <link rel="alternate" hrefLang="en" href={`https://aiplans.dev/en${pathname === '/' ? '' : pathname}`} />
        <link rel="alternate" hrefLang="zh" href={`https://aiplans.dev/zh${pathname === '/' ? '' : pathname}`} />
        <link rel="alternate" hrefLang="x-default" href={`https://aiplans.dev${pathname === '/' ? '' : pathname}`} />

        {/* Canonical */}
        <link rel="canonical" href={canonicalUrl} />

        {/* JSON-LD Structured Data - Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "aiplans.dev",
              "url": "https://aiplans.dev",
              "logo": "https://aiplans.dev/logo.png",
              "description": isZh
                ? "全网最专业的 AI 价格对比平台"
                : "The most comprehensive AI pricing comparison platform"
            })
          }}
        />
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

        {/* FAQ Structured Data for key pages */}
        {pathname.includes('api-pricing') && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": (faqData['api-pricing']?.[isZh ? 'zh' : 'en'] || []).map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              })
            }}
          />
        )}
        {pathname.includes('compare/plans') && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": (faqData['compare/plans']?.[isZh ? 'zh' : 'en'] || []).map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              })
            }}
          />
        )}

        {/* BreadcrumbList Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": isZh ? "首页" : "Home",
                  "item": "https://aiplans.dev"
                },
                ...(pathname !== `/${locale}` ? [{
                  "@type": "ListItem",
                  "position": 2,
                  "name": pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || (isZh ? "首页" : "Home"),
                  "item": `https://aiplans.dev${pathname}`
                }] : [])
              ]
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
