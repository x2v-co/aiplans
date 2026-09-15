import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/video-models',
    title: {
      en: 'AI Video Models Compared · Sora, Veo, Kling, Runway | aiplans.dev',
      zh: 'AI 视频模型对比 · Sora、Veo、Kling、Runway | aiplans.dev',
    },
    description: {
      en: 'Compare AI video generation models by text-to-video, image-to-video, max duration, resolution, camera control, character consistency, price unit and API availability.',
      zh: '按文生视频、图生视频、最大时长、分辨率、镜头控制、角色一致性、价格单位和 API 可用性对比 AI 视频生成模型。',
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="video-model" />
    </>
  );
}
