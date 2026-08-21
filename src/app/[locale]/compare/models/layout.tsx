import type { Metadata } from 'next';
import { buildMetadata, faqPage, type Locale } from '@/lib/seo';

const FAQ = {
  en: [
    {
      question: 'Which AI model is the best value for API usage?',
      answer:
        'It depends on your task. For high-volume, latency-tolerant workloads, open models like DeepSeek and Qwen on aggregator channels are often the cheapest per 1M tokens; frontier models like Claude Opus and GPT series cost more but lead on Agent Arena performance. Use this page to compare the cheapest available channel price of each model side by side — prices are normalised to USD for comparison but displayed in each channel’s own currency.',
    },
    {
      question: 'How are API token prices compared across channels and currencies?',
      answer:
        'Every channel price is converted to USD using cached exchange rates before taking the minimum, so a ¥3/1M CNY channel is correctly ranked against a $0.78/1M USD channel. The cheapest input price determines the recommended channel; output and cached-input prices are shown alongside. The "vs Official" row shows how much cheaper (or dearer) that channel is versus the model producer’s own API.',
    },
  ],
  zh: [
    {
      question: '哪款 AI 模型的 API 性价比最高？',
      answer:
        '取决于你的任务。对高并发、对延迟不敏感的场景，DeepSeek、通义千问等开源模型在聚合渠道上每百万 token 通常最便宜；Claude Opus、GPT 系列等前沿模型价格更高但在 Agent Arena 性能上领先。在本页横向对比各模型的最便宜渠道价格——比较时统一折算为美元，但展示时保留各渠道的原始货币。',
    },
    {
      question: '不同渠道、不同货币的 API token 价格是怎么对比的？',
      answer:
        '每个渠道价格在取最小值前都会按缓存汇率换算成美元，因此 ¥3/1M 的人民币渠道会被正确地与 $0.78/1M 的美元渠道排序。以最便宜的输入价作为推荐渠道，并同时展示输出价和缓存输入价。“对比官方”一行显示该渠道相对模型厂商官方 API 便宜（或更贵）的百分比。',
    },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale: (locale === 'zh' ? 'zh' : 'en') as Locale,
    path: '/compare/models',
    title: {
      en: 'AI Model Comparison Side by Side · Price, Performance & Context | aiplans.dev',
      zh: 'AI 模型横向对比 · 价格、性能与上下文 | aiplans.dev',
    },
    description: {
      en: 'Compare 2–4 AI models side by side: Agent Arena performance, context windows, and the cheapest API token prices across every official, cloud and aggregator channel. Prices audited daily.',
      zh: '选择 2–4 个 AI 模型横向对比：Agent Arena 性能、上下文窗口，以及官方、云、聚合渠道中最便宜的 API token 价格。价格每日审计。',
    },
  });
}

export default async function CompareModelsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const faqs = locale === 'zh' ? FAQ.zh : FAQ.en;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqPage(faqs) }}
      />
      {children}
    </>
  );
}
