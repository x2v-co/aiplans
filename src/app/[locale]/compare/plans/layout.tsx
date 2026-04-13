import type { Metadata } from 'next';
import { buildMetadata, faqPage, type Locale } from '@/lib/seo';

const FAQ = {
  en: [
    {
      question: 'Is Claude Pro better than ChatGPT Plus?',
      answer:
        'Both cost $20/mo. Claude Pro tends to be stronger at long-form coding and document tasks; ChatGPT Plus has a larger plugin/agent ecosystem and image generation. For heavy users, Claude Max ($100/$200) and ChatGPT Pro ($200) lift usage caps significantly.',
    },
    {
      question: 'Which AI subscription has the most generous free tier?',
      answer:
        'Google AI Plus at $7.99/mo is the cheapest paid tier. Mistral Le Chat Pro is €14.99/mo with no quota throttling on most features. The free tiers of Gemini, Claude, ChatGPT and DeepSeek are all comparable for casual use.',
    },
  ],
  zh: [
    {
      question: 'Claude Pro 比 ChatGPT Plus 更值吗？',
      answer:
        '两者都是 $20/月。Claude Pro 在长文本编程和文档处理上更强；ChatGPT Plus 拥有更大的插件/Agent 生态和图像生成能力。对重度用户，Claude Max ($100/$200) 和 ChatGPT Pro ($200) 能显著提升配额。',
    },
    {
      question: '哪款 AI 订阅免费额度最划算？',
      answer:
        'Google AI Plus $7.99/月是最便宜付费档。Mistral Le Chat Pro €14.99/月大部分功能不限速。Gemini、Claude、ChatGPT、DeepSeek 的免费档对日常使用基本够用。',
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
    path: '/compare/plans',
    title: {
      en: 'AI Subscription Plans Compared · ChatGPT vs Claude vs Gemini | aiplans.dev',
      zh: 'AI 订阅套餐对比 · ChatGPT vs Claude vs Gemini | aiplans.dev',
    },
    description: {
      en: 'Side-by-side comparison of ChatGPT Plus / Pro / Team, Claude Pro / Max / Team, Google AI Pro / Ultra, Mistral Le Chat, MiniMax, Kimi, GLM and more. Pricing audited daily.',
      zh: '横向对比 ChatGPT Plus/Pro/Team、Claude Pro/Max/Team、Google AI Pro/Ultra、Mistral Le Chat、MiniMax、Kimi、GLM 等主流 AI 订阅。价格每日审计。',
    },
  });
}

export default async function ComparePlansLayout({
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
