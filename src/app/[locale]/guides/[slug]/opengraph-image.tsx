import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { isPricingGuideSlug, PRICING_GUIDES } from '@/lib/pricing-guides';
import { decodeSlugParam } from '@/lib/route-params';

export const alt = 'AI API Pricing Guide - aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const isZh = locale === 'zh';
  const guide = isPricingGuideSlug(slug) ? PRICING_GUIDES[slug] : null;

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? 'API 价格指南' : 'API Pricing Guide',
      title: guide?.title[isZh ? 'zh' : 'en'] ?? slug,
      subtitle: guide?.description[isZh ? 'zh' : 'en']
        ?? (isZh ? '模型、渠道与 token 成本对比' : 'Models, channels, and token cost comparisons'),
      stats: isZh
        ? [
            { label: '数据', value: '持续更新' },
            { label: '价格来源', value: '可核验' },
            { label: '成本示例', value: '可复算' },
          ]
        : [
            { label: 'Data', value: 'Live' },
            { label: 'Sources', value: 'Auditable' },
            { label: 'Examples', value: 'Reproducible' },
          ],
      accent: '#0f766e',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}

