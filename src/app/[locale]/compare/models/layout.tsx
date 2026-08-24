import type { Metadata } from 'next';
import { buildMetadata, type Locale } from '@/lib/seo';

/**
 * Route metadata (canonical/hreflang/OG) for /compare/models.
 *
 * The FAQ used to be emitted here as a static FAQPage with NO visible
 * counterpart on the page — a violation of Google's FAQ structured-data
 * policy. The FAQ is now visible in compare-models-view.tsx and its JSON-LD
 * is emitted by page.tsx, so this layout intentionally emits no JSON-LD.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/compare/models',
    title: {
      en: 'AI Model Comparison Side by Side · Price, Performance & Context | aiplans.dev',
      zh: 'AI 模型横向对比 · 价格、性能与上下文 | aiplans.dev',
    },
    description: {
      en: 'Compare 2–4 AI models side by side: Agent Arena performance, context windows, and the cheapest API token prices across every official, cloud and aggregator channel. Prices audited daily.',
      zh: '选择 2–4 个 AI 模型横向对比：Agent Arena 性能、上下文窗口，以及官方、云、聚合渠道中最便宜的 API token 价格。价格每日审计。',
    },
  });
}

export default function CompareModelsLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <>{children}</>;
}
