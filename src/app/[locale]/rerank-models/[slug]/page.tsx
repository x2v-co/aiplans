import type { Metadata } from 'next';
import { decodeSlugParam } from '@/lib/route-params';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelDetail } from '@/lib/vertical-model-detail';
import VerticalModelDetailPage from '@/components/vertical-model-detail-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const { item } = await getVerticalModelDetail('rerank-model', slug);
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: `/rerank-models/${slug}`,
    title: {
      en: `${item.name} Rerank Model · Availability, Sources, Plans | aiplans.dev`,
      zh: `${item.name} 重排序模型 · 可用性、来源与套餐 | aiplans.dev`,
    },
    description: {
      en: `Track ${item.name} by provider, modalities, access paths, pricing unit, verified sources and related plans.`,
      zh: `追踪 ${item.name} 的提供商、输入输出模态、访问方式、计价单位、来源和相关套餐。`,
    },
  });
}

export default async function RerankModelDetailRoute({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const detail = await getVerticalModelDetail('rerank-model', slug);
  const crumbs = breadcrumbList([
    { name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: locale === 'zh' ? '重排序模型' : 'Rerank Models', url: `${SITE_URL}/${locale}/rerank-models` },
    { name: detail.item.name, url: `${SITE_URL}/${locale}/rerank-models/${slug}` },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalModelDetailPage locale={locale} kind="rerank-model" detail={detail} />
    </>
  );
}
