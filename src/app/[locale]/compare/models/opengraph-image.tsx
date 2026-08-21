import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'AI Model Comparison — aiplans.dev';
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
      kicker: isZh ? '模型对比' : 'Model Compare',
      title: isZh ? 'AI 模型横向对比' : 'AI Models, Side by Side',
      subtitle: isZh
        ? '对比 Agent Arena 性能、上下文窗口，以及各渠道最便宜的 API token 价格'
        : 'Compare Agent Arena score, context windows, and the cheapest API prices across channels',
      stats: isZh
        ? [
            { label: '可选模型', value: '250+' },
            { label: '最多对比', value: '4' },
            { label: '价格每日审计', value: '✓' },
          ]
        : [
            { label: 'Models', value: '250+' },
            { label: 'Compare up to', value: '4' },
            { label: 'Audited daily', value: '✓' },
          ],
      accent: '#7c3aed',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
