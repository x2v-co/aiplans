import type { Metadata } from 'next';
import { buildMetadata, faqPage, type Locale } from '@/lib/seo';

const FAQ = {
  en: [
    {
      question: 'What is the cheapest GPT-4 API provider?',
      answer:
        'The cheapest GPT-4 API provider varies by region. Generally, Chinese aggregators like SiliconFlow and 火山引擎 (Volcengine) offer 30-50% lower pricing than the official OpenAI API for the same models.',
    },
    {
      question: 'How are these prices verified?',
      answer:
        'aiplans.dev runs hourly scrapers against official provider pages plus a daily data-accuracy audit that cross-checks every channel against the model producer’s published price. Stale or inconsistent rows are flagged and corrected.',
    },
    {
      question: 'Which API works in mainland China?',
      answer:
        'Chinese providers like Zhipu (智谱), Qwen (通义千问), Moonshot Kimi, MiniMax, Hunyuan and DeepSeek work natively. International providers like OpenRouter, OpenAI, Anthropic and Google AI require a proxy or VPN.',
    },
  ],
  zh: [
    {
      question: '哪个 GPT-4 API 提供商最便宜？',
      answer:
        '不同区域有不同最便宜方案。整体来看，国内聚合平台如硅基流动、火山引擎价格比 OpenAI 官方便宜 30-50%。',
    },
    {
      question: '这些价格是怎么核对的？',
      answer:
        'aiplans.dev 每小时跑 scraper 抓取官方页面，并每天跑数据准确性 audit，对比每个渠道和模型生产方的官方价。过期或异常的数据会被标记并修正。',
    },
    {
      question: '哪些 API 可以在中国大陆直连？',
      answer:
        '国内厂商如智谱、通义千问、Kimi、MiniMax、混元、DeepSeek 都能直连。OpenAI、Anthropic、Google AI、OpenRouter 等国际厂商需要代理或 VPN。',
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
    path: '/api-pricing',
    title: {
      en: 'API Pricing Comparison · Cheapest AI API Channels | aiplans.dev',
      zh: 'API 价格对比 · 最便宜的 AI API 渠道汇总 | aiplans.dev',
    },
    description: {
      en: 'Compare GPT-4o, Claude, DeepSeek, Gemini, Qwen API pricing across official providers, Azure, AWS Bedrock, OpenRouter, SiliconFlow and more. Updated hourly with audited data.',
      zh: '对比 GPT-4o、Claude、DeepSeek、Gemini、通义千问等 API 价格在官方渠道、Azure、AWS Bedrock、OpenRouter、硅基流动等的差异。每小时更新，数据经过准确性审计。',
    },
  });
}

export default async function ApiPricingLayout({
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
