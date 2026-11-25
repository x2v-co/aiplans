import { getComparisonPage } from '@/lib/model-plan-comparison';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { isGluedModelSlug } from '@/lib/glued-model-slug';
import { buildMetadata, type Locale } from '@/lib/seo';
import { decodeSlugParam } from '@/lib/route-params';
import { formatModelName } from '@/lib/model-names';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}): Promise<Metadata> {
  const { locale, model: rawModel } = await params;
  const modelSlug = decodeSlugParam(rawModel);
  if (isGluedModelSlug(modelSlug)) notFound();
  const resolution = await getComparisonPage(modelSlug);
  if (!resolution) notFound();
  if (resolution.redirect) permanentRedirect(resolution.redirect.replace(/^\/en\//, `/${locale === 'zh' ? 'zh' : 'en'}/`));
  const modelName = formatModelName(resolution.data?.model.name ?? resolution.slug);
  const description = {
    en: `Recorded subscription prices and usage terms for ${modelName}. Missing prices do not mean free access; check provider terms for model availability.`,
    zh: `${modelName} 已记录的订阅价格与用量条款。未记录报价不代表免费；型号可用性以厂商条款为准。`,
  };
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/compare/plans/${modelSlug}`,
    title: { en: `${modelName} subscription comparison`, zh: `${modelName} 订阅套餐对比` },
    description,
    noindex: true,
  });
}

export default function ComparePlansModelLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; model: string }>;
}) {
  return <>{children}</>;
}
