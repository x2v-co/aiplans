import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';

export const alt = 'Compare AI Plans — aiplans.dev';
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
      kicker: isZh ? '计划对比' : 'Compare Plans',
      title: isZh ? 'ChatGPT · Claude · Gemini' : 'ChatGPT · Claude · Gemini',
      subtitle: isZh
        ? '横向对比 Plus、Pro、Team、Max、Enterprise — 月付、年付、模型权限、速率限制'
        : 'Side-by-side Plus / Pro / Team / Max / Enterprise — monthly, yearly, models, rate limits',
      accent: '#10b981',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
