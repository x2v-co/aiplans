import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';
import { getVerticalModelCatalog } from '@/lib/vertical-models';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/music-models',
    title: {
      en: 'AI Music & Audio Model Catalog · Suno, Udio, Stable Audio | aiplans.dev',
      zh: 'AI 音乐与音频模型目录 · Suno、Udio、Stable Audio | aiplans.dev',
    },
    description: {
      en: 'Browse AI music and audio generation models by song length, vocals, instrumentals, stems, voice cloning, commercial rights, pricing unit and API availability.',
      zh: '按歌曲长度、人声、伴奏、stem、声音克隆、商用授权、价格单位和 API 可用性浏览 AI 音乐与音频生成模型目录。',
    },
  });
}

export default async function MusicModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '音乐模型' : 'Music Models', url: `${SITE_URL}/${locale}/music-models` },
  ]);
  const catalog = await getVerticalModelCatalog('music-model');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="music-model" initialCatalog={catalog} />
    </>
  );
}
