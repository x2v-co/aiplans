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
      en: 'Best AI Models by Vendor · Performance, Price & API Channels | aiplans.dev',
      zh: '各厂最强 AI 模型横评 · 性能、价格与 API 渠道 | aiplans.dev',
    },
    description: {
      en: 'Compare one current leading model from OpenAI, Anthropic, Google, xAI, DeepSeek, GLM, Kimi, Qwen and MiniMax, then inspect every API channel offering it.',
      zh: '横向比较 OpenAI、Anthropic、Google、xAI、DeepSeek、GLM、Kimi、Qwen、MiniMax 当前领先模型，再查看每个模型的全部 API 渠道价格。',
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
