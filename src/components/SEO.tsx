'use client';

import { usePathname } from 'next/navigation';
import { StructuredData, useBreadcrumbs, faqData } from './StructuredData';

interface SEOHeadProps {
  locale?: string;
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

// Page-specific metadata
const pageMetadata: Record<string, { title: Record<string, string>; description: Record<string, string> }> = {
  '': {
    title: {
      en: 'aiplans.dev - Compare AI Pricing & Save Money',
      zh: 'aiplans.dev - 全网AI价格对比平台'
    },
    description: {
      en: 'Compare GPT-4, Claude, DeepSeek, Gemini pricing. Find cheapest API channels and save up to 70%.',
      zh: '对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格。找到最便宜的 API 渠道，节省高达 70% 成本。'
    }
  },
  'api-pricing': {
    title: {
      en: 'API Pricing Comparison | Cheapest AI API Channels',
      zh: 'API 价格对比 | 全网最便宜的 AI API 渠道'
    },
    description: {
      en: 'Compare Claude, GPT-4, DeepSeek API prices across providers. Find the cheapest channel for your use case.',
      zh: '对比 Claude、GPT-4、DeepSeek 等模型在不同渠道的 API 价格，找最便宜的供应商。'
    }
  },
  'compare/plans': {
    title: {
      en: 'AI Plan Comparison | ChatGPT Plus vs Claude Pro',
      zh: 'AI 订阅套餐对比 | ChatGPT Plus vs Claude Pro'
    },
    description: {
      en: 'Compare top AI subscription plans. Find the best plan for your needs with detailed feature comparison.',
      zh: '对比主流 AI 订阅套餐，找到最适合你的方案。详细功能对比帮你做出选择。'
    }
  },
  'compare/models': {
    title: {
      en: 'AI Model Comparison | Performance & Pricing',
      zh: 'AI 模型对比 | 性能与价格'
    },
    description: {
      en: 'Compare AI models by benchmark scores, pricing, and features. Make informed decisions.',
      zh: '通过基准分数、价格和功能对比 AI 模型，做出明智的决定。'
    }
  },
  'compare/api': {
    title: {
      en: 'API Price Comparison | Same Model, Different Providers',
      zh: 'API 价格对比 | 同模型，不同供应商'
    },
    description: {
      en: 'Compare the same AI model API across different providers. Find the best deal.',
      zh: '对比同一 AI 模型 API 在不同供应商的价格，找到最优惠的方案。'
    }
  },
  'coupons': {
    title: {
      en: 'AI Coupons & Discount Codes',
      zh: 'AI 优惠码 | 折扣码汇总'
    },
    description: {
      en: 'Discover and share AI service discount codes. Save money on ChatGPT, Claude, and more.',
      zh: '分享和发现 AI 服务的优惠码、折扣码。在 ChatGPT、Claude 等服务上省钱。'
    }
  }
};

export function SEOHead({
  locale = 'en',
  title: customTitle,
  description: customDescription,
  image = 'https://aiplans.dev/logo.png',
  type = 'website'
}: SEOHeadProps) {
  const pathname = usePathname();
  const isZh = locale === 'zh';

  // Get page key from pathname
  const pathKey = pathname.replace(`/${locale}`, '').replace(/^\//, '').split('/')[0] || '';
  const pageMeta = pageMetadata[pathKey] || pageMetadata[''];

  const title = customTitle || pageMeta.title[locale] || pageMeta.title.en;
  const description = customDescription || pageMeta.description[locale] || pageMeta.description.en;

  // Get canonical URL
  const canonicalUrl = `https://aiplans.dev${pathname}`;

  return (
    <>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={
        isZh
          ? 'AI价格,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4价格对比,API价格对比,AI模型对比'
          : 'AI pricing,ChatGPT Plus,Claude Pro,DeepSeek API,GPT-4 price comparison,API pricing comparison'
      } />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="aiplans.dev" />
      <meta property="og:locale" content={isZh ? 'zh_CN' : 'en_US'} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Hreflang */}
      <link rel="alternate" hrefLang="en" href={canonicalUrl.replace(`/${locale}`, '/en').replace('/zh', '/en')} />
      <link rel="alternate" hrefLang="zh" href={canonicalUrl.replace(`/${locale}`, '/zh').replace('/en', '/zh')} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl.replace(`/${locale}`, '')} />

      {/* Structured Data */}
      <StructuredData type="organization" locale={locale} />
      <StructuredData type="website" locale={locale} />
      <StructuredData type="breadcrumb" locale={locale} />

      {/* FAQ Structured Data for key pages */}
      {['api-pricing', 'compare/plans', 'coupons'].includes(pathKey) && (
        <StructuredData type="faq" locale={locale} />
      )}
    </>
  );
}

// SEO Breadcrumb component for pages
export function SEOBreadcrumb() {
  const pathname = usePathname();
  const breadcrumbs = useBreadcrumbs(pathname);

  return <StructuredData type="breadcrumb" data={breadcrumbs} />;
}
