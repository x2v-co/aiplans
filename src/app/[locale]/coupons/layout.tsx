import type { Metadata } from 'next';
import { buildMetadata, faqPage, type Locale } from '@/lib/seo';

/**
 * Coupons was the only indexable static route without its own metadata or
 * FAQ JSON-LD. The questions mirror the visible FAQ on coupons-view.tsx —
 * keep both in sync.
 */
const FAQ = {
  en: [
    {
      question: 'How do I get AI service discount codes?',
      answer:
        'Browse the verified codes on this page and click Copy, then paste it at the provider’s checkout. Codes are submitted by the community and confirmed by other users; look for the Verified badge and a recent confirmation date.',
    },
    {
      question: 'Are these AI coupon codes reliable?',
      answer:
        'Not every code works — promotions expire and some are region-specific. We mark codes as Verified only after multiple community confirmations, and we show expiry dates where known. If a code fails, please report it so others don’t waste time.',
    },
  ],
  zh: [
    {
      question: '如何获取 AI 服务优惠码？',
      answer:
        '在本页浏览已验证的优惠码，点击「复制」后到对应服务商结账页面粘贴即可。优惠码由社区提交并经其他用户确认；请认准「已验证」标签和最近确认日期。',
    },
    {
      question: '这些 AI 优惠码可靠吗？',
      answer:
        '并非所有优惠码都长期有效——促销会到期，部分还有地区限制。只有经过多位社区成员确认的优惠码我们才标记为「已验证」，并尽量展示到期时间。如果某个优惠码失效，请反馈给我们，避免其他人浪费时间。',
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
    path: '/coupons',
    title: {
      en: 'AI Service Coupons & Discount Codes | aiplans.dev',
      zh: 'AI 服务优惠码与折扣 | aiplans.dev',
    },
    description: {
      en: 'Verified discount codes and promotional offers for ChatGPT, Claude, DeepSeek and other AI services. Community-submitted and audited.',
      zh: 'ChatGPT、Claude、DeepSeek 等 AI 服务的已验证优惠码与折扣活动，社区提交、每日审计。',
    },
  });
}

export default async function CouponsLayout({
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
