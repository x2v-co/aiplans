import { ImageResponse } from 'next/og';
import { getPriceIndexSnapshot } from '@/lib/api-price-index';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'AI API Price Index - aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 21600;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === 'zh';
  const snapshot = await getPriceIndexSnapshot().catch((error: unknown) => {
    console.error('Failed to load API price index stats for Open Graph image', error);
    return null;
  });

  const stats = snapshot
    ? (isZh
        ? [
            { label: '定价模型', value: snapshot.modelCount.toLocaleString('zh-CN') },
            { label: '可用渠道', value: snapshot.channelCount.toLocaleString('zh-CN') },
            { label: '供应商', value: snapshot.providerCount.toLocaleString('zh-CN') },
          ]
        : [
            { label: 'Priced models', value: snapshot.modelCount.toLocaleString('en-US') },
            { label: 'Channels', value: snapshot.channelCount.toLocaleString('en-US') },
            { label: 'Providers', value: snapshot.providerCount.toLocaleString('en-US') },
          ])
    : (isZh
        ? [
            { label: '价格数据', value: '持续更新' },
            { label: '供应渠道', value: '多渠道' },
            { label: '价格来源', value: '可核验' },
          ]
        : [
            { label: 'Price data', value: 'Live' },
            { label: 'Coverage', value: 'Multi-channel' },
            { label: 'Sources', value: 'Auditable' },
          ]);

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? '市场数据报告' : 'Market Data Report',
      title: isZh ? 'AI API 价格指数' : 'AI API Price Index',
      subtitle: isZh
        ? '跨官方、云平台和聚合渠道对比当前 token 价格'
        : 'Current token prices across direct, cloud, and aggregator channels',
      stats,
      accent: '#0f766e',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
