import type { Metadata } from 'next';
import { decodeSlugParam } from '@/lib/route-params';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelDetail } from '@/lib/vertical-model-detail';
import VerticalModelDetailPage from '@/components/vertical-model-detail-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const { item } = await getVerticalModelDetail('music-model', slug);
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/music-models/${slug}`,
    title: {
      en: `${item.name} Music Model · Pricing, Plans, Sources | aiplans.dev`,
      zh: `${item.name} 音乐模型 · 价格、套餐与来源 | aiplans.dev`,
    },
    description: {
      en: `Track ${item.name} by provider, modalities, access paths, pricing unit, verified sources and related plans.`,
      zh: `追踪 ${item.name} 的提供商、输入输出模态、访问方式、计价单位、来源和相关套餐。`,
    },
  });
}

export default async function MusicModelDetailRoute({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const detail = await getVerticalModelDetail('music-model', slug);
  const crumbs = breadcrumbList([
    { name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: locale === 'zh' ? '音乐模型' : 'Music Models', url: `${SITE_URL}/${locale}/music-models` },
    { name: detail.item.name, url: `${SITE_URL}/${locale}/music-models/${slug}` },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalModelDetailPage locale={locale} kind="music-model" detail={detail} />
    </>
  );
}
