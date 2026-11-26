import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SiteHeader from '@/components/SiteHeader';
import { EmbeddingModelCatalog } from '@/components/audited-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import { buildMetadata, breadcrumbList, SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale: locale === 'zh' ? 'zh' : 'en', path: '/rerank-models',
    title: { en: 'Rerank Models · Voyage AI | aiplans.dev', zh: '重排序模型 · Voyage AI | aiplans.dev' },
    description: { en: 'Compare official reranker API prices by processed tokens and verified sources.', zh: '按处理 token 数和核验来源比较官方重排序 API 价格。' } });
}
export default async function RerankModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rerankModels' });
  const catalog = await getVerticalModelCatalog('rerank-model');
  const crumbs = breadcrumbList([{ name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` }, { name: t('title'), url: `${SITE_URL}/${locale}/rerank-models` }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} /><SiteHeader locale={locale} />
    <main className="container mx-auto px-4 py-14"><h1 className="text-4xl font-bold">{t('title')}</h1><p className="mt-5">{t('description')}</p><EmbeddingModelCatalog items={catalog} locale={locale} /></main></>;
}
