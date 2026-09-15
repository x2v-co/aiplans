import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelCatalog } from '@/lib/vertical-models';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/video-models',
    title: {
      en: 'AI Video Model Catalog · Veo, Kling, Runway, Pika | aiplans.dev',
      zh: 'AI 视频模型目录 · Veo、Kling、Runway、Pika | aiplans.dev',
    },
    description: {
      en: 'Browse AI video generation models by text-to-video, image-to-video, Arena AI rank, VBench scores, pricing unit, API availability and official sources.',
      zh: '按文生视频、图生视频、Arena AI 排名、VBench 分数、价格单位、API 可用性和官方来源浏览 AI 视频生成模型目录。',
    },
  });
}

export default async function VideoModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '视频模型' : 'Video Models', url: `${SITE_URL}/${locale}/video-models` },
  ]);
  const catalog = await getVerticalModelCatalog('video-model');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="video-model" initialCatalog={catalog} />
    </>
  );
}
