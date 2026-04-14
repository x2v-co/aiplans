import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import LocaleClientWrapper from '@/components/locale-client-wrapper';
import enMessages from '@/../messages/en.json';
import zhMessages from '@/../messages/zh.json';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

const messagesMap: Record<string, any> = {
  en: enMessages,
  zh: zhMessages,
};

/**
 * Site-wide metadata via the Next.js Metadata API. This REPLACES the
 * old hand-rolled <head> JSX which was duplicating every tag with what
 * page-level generateMetadata() was emitting (2× title, 2× canonical,
 * 2× og:image, etc.). Child pages / nested layouts override fields
 * individually via their own generateMetadata — Next.js merges the tree.
 *
 * IMPORTANT: keep `openGraph.images` and `twitter.images` UNSET here so
 * per-route opengraph-image.tsx files can populate the OG image slot
 * for each page. Setting a default here would override them.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'aiplans.dev — Compare AI Pricing',
    template: '%s',
  },
  description:
    'Compare GPT-4, Claude, DeepSeek, Gemini pricing across official and aggregator channels. Find the cheapest AI API.',
  applicationName: SITE_NAME,
  authors: [{ name: 'aiplans.dev' }],
  keywords: [
    'AI pricing', 'ChatGPT Plus', 'Claude Pro', 'DeepSeek API',
    'GPT-4 price comparison', 'API pricing comparison',
    'AI价格', 'AI价格对比', 'API价格对比',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Baidu / 360 / Sogou rendering hints. Next.js Metadata API doesn't
  // have typed fields for these so we fall through to the 'other' map.
  other: {
    'applicable-device': 'pc,mobile',
    'MobileOptimized': 'width',
    'HandheldFriendly': 'true',
    // Uncomment after registering the site at https://ziyuan.baidu.com/
    // 'baidu-site-verification': 'TODO',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    // images intentionally omitted — per-route opengraph-image.tsx
    // supplies the right picture per page.
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

interface FAQItem { question: string; answer: string }
type FAQData = Record<string, Record<string, FAQItem[]>>;

// FAQ data (currently unused — per-route FAQ JSON-LD lives in each
// page's own layout.tsx). Kept here as a reference corpus in case we
// later centralize it.
const _faqData: FAQData = {};
void _faqData;

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <LocaleLayoutContent params={params}>{children}</LocaleLayoutContent>;
}

async function LocaleLayoutContent({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = messagesMap[locale] || enMessages;
  const isZh = locale === 'zh';

  // BCP-47 language tag — `zh-CN` beats plain `zh` for Baidu + screen
  // readers that need script info.
  const htmlLang = isZh ? 'zh-CN' : 'en-US';

  return (
    <html lang={htmlLang}>
      <head>
        {/* Two site-wide JSON-LD graphs. Page-level JSON-LD (Product,
            Breadcrumb, FAQ, ItemList) is emitted by each route's own
            layout or page; these Organization + WebSite blocks stay
            global so Google can build the entity once per request. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'aiplans.dev',
              alternateName: isZh ? 'AI Plans 价格对比' : 'AI Plans',
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              description: isZh
                ? '全网最专业的 AI 价格对比平台'
                : 'The most comprehensive AI pricing comparison platform',
              foundingDate: '2025',
              sameAs: ['https://github.com/x2v-co/aiplans'],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: isZh ? 'aiplans.dev - 全网AI价格对比' : 'aiplans.dev - AI Pricing Comparison',
              alternateName: isZh ? 'AI 价格对比' : 'AI Pricing Comparison',
              description: isZh
                ? '对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格'
                : 'Compare AI model pricing across providers',
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${SITE_URL}/${locale}/api-pricing?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
              inLanguage: isZh ? 'zh-CN' : 'en-US',
              publisher: {
                '@type': 'Organization',
                name: 'aiplans.dev',
                url: SITE_URL,
                logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
              },
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Analytics />
        <SpeedInsights />
        <LocaleClientWrapper locale={locale} messages={messages}>
          {children}
        </LocaleClientWrapper>
      </body>
    </html>
  );
}
