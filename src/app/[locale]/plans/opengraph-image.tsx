import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'AI Subscription Plans — aiplans.dev';
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
      kicker: isZh ? '订阅计划' : 'Subscription Plans',
      title: isZh ? 'AI 订阅计划总览' : 'AI Subscription Plans',
      subtitle: isZh
        ? '浏览 OpenAI、Anthropic、Google、Mistral、Kimi、智谱 GLM、MiniMax 等全部订阅档位'
        : 'Browse OpenAI, Anthropic, Google, Mistral, Kimi, Zhipu GLM, MiniMax and more',
      stats: isZh
        ? [
            { label: '供应商', value: '14+' },
            { label: '计划数', value: '50+' },
            { label: '每日审计', value: '✓' },
          ]
        : [
            { label: 'Providers', value: '14+' },
            { label: 'Plans', value: '50+' },
            { label: 'Daily audit', value: '✓' },
          ],
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
