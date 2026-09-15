import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelCatalog } from '@/lib/vertical-models';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/world-models',
    title: {
      en: 'AI World Models Tracked · Genie, Cosmos, World Labs | aiplans.dev',
      zh: 'AI 世界模型追踪 · Genie、Cosmos、World Labs | aiplans.dev',
    },
    description: {
      en: 'Track world models and simulation models by availability, input and output modality, interactivity, physical consistency, latency, frame rate and API maturity.',
      zh: '按可用性、输入输出模态、交互性、物理一致性、延迟、帧率和 API 成熟度追踪世界模型与仿真模型。',
    },
  });
}

export default async function WorldModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '世界模型' : 'World Models', url: `${SITE_URL}/${locale}/world-models` },
  ]);
  const catalog = await getVerticalModelCatalog('world-model');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="world-model" initialCatalog={catalog} />
    </>
  );
}
