import type { Metadata } from 'next';
import { buildMetadata, type Locale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/calculator',
    title: {
      en: 'AI API Cost Calculator · Compare Monthly Model Costs | aiplans.dev',
      zh: 'AI API 成本计算器 · 对比模型月度费用 | aiplans.dev',
    },
    description: {
      en: 'Estimate monthly AI API spend by requests, input and output tokens, prompt caching and batch usage. Compare models and channels in one currency.',
      zh: '按请求量、输入输出 Token、缓存命中率和 Batch 比例估算每月 AI API 成本，并统一对比不同模型和渠道。',
    },
  });
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
