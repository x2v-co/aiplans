import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { buildMetadata, type Locale } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}): Promise<Metadata> {
  const { locale, model: modelSlug } = await params;

  const { data: model } = await supabase
    .from('models')
    .select('name')
    .eq('slug', modelSlug)
    .maybeSingle();
  const modelName = model?.name ?? modelSlug;

  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/compare/plans/${modelSlug}`,
    title: {
      en: `${modelName} Subscription Plans Compared | aiplans.dev`,
      zh: `${modelName} 订阅计划对比 | aiplans.dev`,
    },
    description: {
      en: `Side-by-side comparison of every subscription plan that includes ${modelName}. Monthly vs annual pricing, message limits, rate limits, and team/enterprise tiers across OpenAI, Anthropic, Google, Mistral and more.`,
      zh: `横向对比包含 ${modelName} 的全部订阅计划。月付/年付价格、消息限额、速率限制、团队/企业档位——涵盖 OpenAI、Anthropic、Google、Mistral 等。`,
    },
  });
}

export default async function ComparePlansModelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
