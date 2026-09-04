import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'Leading AI models and API channel comparison - aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? '九大厂商' : '9 Major Vendors',
      title: isZh ? '各厂领先 AI 模型横评' : 'Leading AI Models by Vendor',
      subtitle: isZh
        ? '先比较性能与成本，再查看同一模型的全部 API 渠道价格'
        : 'Compare performance and cost, then inspect every API channel for your chosen model',
      stats: isZh
        ? [
            { label: '主流厂商', value: '9' },
            { label: '最多对比', value: '4' },
            { label: '价格审计', value: '每日' },
          ]
        : [
            { label: 'Major vendors', value: '9' },
            { label: 'Compare up to', value: '4' },
            { label: 'Price audit', value: 'Daily' },
          ],
      accent: '#7c3aed',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
