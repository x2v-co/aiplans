import type { Metadata } from 'next';
import { getVerticalModelCatalog } from '@/lib/vertical-models';
import { arenaVideoLeaderboardCatalogItems } from '@/lib/arena-video-leaderboard';
import { buildMetadata, breadcrumbList, faqPage, SITE_URL, type Locale } from '@/lib/seo';
import VideoModelCompareView from './video-model-compare-view';

const FAQS = {
  en: [
    {
      question: 'Is Arena AI rank the same as VBench?',
      answer: 'No. Arena AI is a public preference leaderboard, while VBench and VBench++ are benchmark suites with different task definitions. This page keeps each source separate instead of combining them into one score.',
    },
    {
      question: 'Why are there no audio model ranks here?',
      answer: 'The current public arena.ai payload exposes chat, webdev, image, search and video ranking modalities, but not a separate audio or music leaderboard. We only show source-backed ranks.',
    },
  ],
  zh: [
    {
      question: 'Arena AI 排名和 VBench 是同一个东西吗？',
      answer: '不是。Arena AI 是公开偏好排行榜，VBench / VBench++ 是不同任务定义下的评测套件。本页保留各自来源和口径，不合成为一个总分。',
    },
    {
      question: '为什么没有音频模型排名？',
      answer: '当前 arena.ai 公开 payload 暴露的是 chat、webdev、image、search、video 这些 modality，没有独立 audio/music leaderboard。我们只展示有来源支撑的排名。',
    },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/compare/video-models',
    title: {
      en: 'Compare AI Video Models · Arena AI, VBench, Pricing Units | aiplans.dev',
      zh: 'AI 视频模型对比 · Arena AI、VBench、价格单位 | aiplans.dev',
    },
    description: {
      en: 'Compare video generation models across Arena AI video rank, VBench, VBench++, modalities, access paths, pricing units and official sources.',
      zh: '按 Arena AI 视频排名、VBench、VBench++、输入输出模态、访问方式、计价单位和官方来源对比视频生成模型。',
    },
  });
}

export default async function CompareVideoModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const loc = (locale === 'zh' ? 'zh' : 'en') as Locale;
  const catalogModels = await getVerticalModelCatalog('video-model');
  const leaderboardModels = arenaVideoLeaderboardCatalogItems();
  const leaderboardSlugs = new Set(leaderboardModels.map((model) => model.slug));
  const models = [
    ...leaderboardModels,
    ...catalogModels.filter((model) => !model.slug || !leaderboardSlugs.has(model.slug)),
  ];
  const crumbs = breadcrumbList([
    { name: isZh ? '首页' : 'Home', url: `${SITE_URL}/${locale}` },
    { name: isZh ? '视频模型对比' : 'Video model compare', url: `${SITE_URL}/${locale}/compare/video-models` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqPage(FAQS[loc]) }} />
      <VideoModelCompareView locale={locale} models={models} />
    </>
  );
}
