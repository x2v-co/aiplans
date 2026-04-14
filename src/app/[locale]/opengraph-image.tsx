import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'aiplans.dev — AI Pricing Comparison';
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
      kicker: isZh ? '全网 AI 比价' : 'AI Pricing',
      title: isZh ? 'aiplans.dev' : 'aiplans.dev',
      subtitle: isZh
        ? '对比 GPT-4、Claude、DeepSeek、Gemini 等 AI 模型价格，找到最便宜的渠道'
        : 'Compare GPT-4, Claude, DeepSeek, Gemini and more. Find the cheapest AI API channel.',
      stats: isZh
        ? [
            { label: '模型', value: '250+' },
            { label: '渠道', value: '27' },
            { label: '订阅档', value: '50+' },
          ]
        : [
            { label: 'Models', value: '250+' },
            { label: 'Channels', value: '27' },
            { label: 'Plans', value: '50+' },
          ],
      locale: locale === 'zh' ? 'zh' : 'en',
    }),
    size,
  );
}
