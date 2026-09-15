import type { Metadata } from 'next';
import VerticalLandingPage from '@/components/vertical-landing-page';
import { buildMetadata, breadcrumbList, SITE_URL, type Locale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/creative-plans',
    title: {
      en: 'AI Creative Plans Compared · Video, Image and Music | aiplans.dev',
      zh: 'AI 创作套餐对比 · 视频、图片、音乐 | aiplans.dev',
    },
    description: {
      en: 'Compare AI video, image and music generation plans by credits, seconds, generations, resolution, commercial rights, watermarking and API availability.',
      zh: '按 credits、秒数、生成次数、分辨率、商用授权、水印和 API 可用性对比 AI 视频、图片、音乐创作套餐。',
    },
  });
}

export default async function CreativePlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '创作套餐' : 'Creative Plans', url: `${SITE_URL}/${locale}/creative-plans` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <VerticalLandingPage locale={locale} kind="creative-plan" />
    </>
  );
}
