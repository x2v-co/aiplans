import type { Metadata } from 'next';
import { buildMetadata, type Locale } from '@/lib/seo';

/**
 * Route-level metadata (canonical/hreflang/OG) for /api-pricing.
 *
 * The FAQ used to be emitted here as a static FAQPage — but it had no visible
 * counterpart on the page, which violates Google's FAQ structured-data policy
 * (FAQ content must be visible), and the answer even hardcoded a generic
 * "30-50% cheaper" claim. The data-driven, *visible* FAQ now lives in
 * page.tsx + api-pricing-view.tsx and is mirrored by FAQPage JSON-LD there.
 * This layout intentionally emits no JSON-LD.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/api-pricing',
    title: {
      en: 'API Pricing Comparison · Cheapest AI API Channels | aiplans.dev',
      zh: 'API 价格对比 · 最便宜的 AI API 渠道汇总 | aiplans.dev',
    },
    description: {
      en: 'Compare GPT-4o, Claude, DeepSeek, Gemini, Qwen API pricing across official providers, Azure, AWS Bedrock, OpenRouter, SiliconFlow and more. Updated daily with audited data.',
      zh: '对比 GPT-4o、Claude、DeepSeek、Gemini、通义千问等 API 价格在官方渠道、Azure、AWS Bedrock、OpenRouter、硅基流动等的差异。每日更新，数据经过准确性审计。',
    },
  });
}

export default function ApiPricingLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <>{children}</>;
}
