import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'API Pricing Comparison — aiplans.dev';
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
      kicker: isZh ? 'API 价格' : 'API Pricing',
      title: isZh ? 'API 价格对比' : 'API Pricing Comparison',
      subtitle: isZh
        ? '对比 GPT-4o、Claude、DeepSeek、Gemini、Qwen 在不同渠道的每百万 token 价格'
        : 'Compare GPT-4o, Claude, DeepSeek, Gemini, Qwen per-1M-token prices across channels',
      stats: isZh
        ? [
            { label: '模型', value: '250+' },
            { label: '官方 / 云 / 聚合', value: '27' },
            { label: '每小时更新', value: '✓' },
          ]
        : [
            { label: 'Models', value: '250+' },
            { label: 'Channels', value: '27' },
            { label: 'Hourly refresh', value: '✓' },
          ],
      locale: locale === 'zh' ? 'zh' : 'en',
    }),
    size,
  );
}
