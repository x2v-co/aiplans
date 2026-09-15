import type { Metadata } from 'next';
import { decodeSlugParam } from '@/lib/route-params';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelDetail } from '@/lib/vertical-model-detail';
import VerticalModelDetailPage from '@/components/vertical-model-detail-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const { item } = await getVerticalModelDetail('world-model', slug);
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/world-models/${slug}`,
    title: {
      en: `${item.name} World Model · Availability, Sources, Plans | aiplans.dev`,
      zh: `${item.name} 世界模型 · 可用性、来源与套餐 | aiplans.dev`,
    },
    description: {
      en: `Track ${item.name} by provider, modalities, access paths, pricing unit, verified sources and related plans.`,
      zh: `追踪 ${item.name} 的提供商、输入输出模态、访问方式、计价单位、来源和相关套餐。`,
    },
  });
}

export default async function WorldModelDetailRoute({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const detail = await getVerticalModelDetail('world-model', slug);
  const crumbs = breadcrumbList([
    { name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: locale === 'zh' ? '世界模型' : 'World Models', url: `${SITE_URL}/${locale}/world-models` },
    { name: detail.item.name, url: `${SITE_URL}/${locale}/world-models/${slug}` },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalModelDetailPage locale={locale} kind="world-model" detail={detail} />
    </>
  );
}
