import type { Metadata } from 'next';
import { buildMetadata, type Locale } from '@/lib/seo';

// NOTE: the index page's FAQ used to be emitted here, which leaked it onto
// every /compare/plans/[model] child — producing two FAQPage blocks on those
// pages (one generic index FAQ, one model-specific). The model-specific FAQ
// is now emitted by [model]/page.tsx, and this layout emits no JSON-LD.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/compare/plans',
    title: {
      en: 'AI Subscription Plans Compared · ChatGPT vs Claude vs Gemini | aiplans.dev',
      zh: 'AI 订阅套餐对比 · ChatGPT vs Claude vs Gemini | aiplans.dev',
    },
    description: {
      en: 'Side-by-side comparison of ChatGPT Plus / Pro / Team, Claude Pro / Max / Team, Google AI Pro / Ultra, Mistral Le Chat, MiniMax, Kimi, GLM and more. Pricing audited daily.',
      zh: '横向对比 ChatGPT Plus/Pro/Team、Claude Pro/Max/Team、Google AI Pro/Ultra、Mistral Le Chat、MiniMax、Kimi、GLM 等主流 AI 订阅。价格每日审计。',
    },
  });
}

export default function ComparePlansLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <>{children}</>;
}
