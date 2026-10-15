import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SiteHeader from '@/components/SiteHeader';
import { DecisionModelCatalog } from '@/components/audited-catalog';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import { buildMetadata, breadcrumbList, SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({ locale: locale === 'zh' ? 'zh' : 'en', path: '/decision-models',
    title: { en: 'Decision Models · ScaleDown, SubQ Snap, Jev | aiplans.dev', zh: '决策模型 · ScaleDown、SubQ Snap、Jev | aiplans.dev' },
    description: { en: 'Compare decision APIs by input token pricing and per-million-task pricing, with unknown prices flagged for verification.', zh: '按输入 token 和每百万次任务比较决策 API，明确标记待核验价格。' } });
}
export default async function DecisionModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'decisionModels' });
  const catalog = await getVerticalModelCatalog('decision-model');
  const crumbs = breadcrumbList([{ name: locale === 'zh' ? '首页' : 'Home', url: `${SITE_URL}/${locale}` }, { name: t('title'), url: `${SITE_URL}/${locale}/decision-models` }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} /><SiteHeader locale={locale} />
    <main className="container mx-auto px-4 py-14"><h1 className="text-4xl font-bold">{t('title')}</h1><p className="mt-5">{t('description')}</p><DecisionModelCatalog items={catalog} locale={locale} /></main></>;
}
