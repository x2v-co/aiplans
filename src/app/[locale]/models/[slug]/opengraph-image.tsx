import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { supabase } from '@/lib/supabase';

export const alt = 'Model API Pricing — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Fetches real data per model so shared Twitter/WeChat cards show the
// actual model name + price range + Arena ELO instead of a generic logo.
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isZh = locale === 'zh';

  // Fetch model + channels + arena elo. These are small queries and the
  // result is cached by Vercel because opengraph-image.tsx output is
  // static-ish (revalidated on deploy, not per request).
  const [{ data: model }, { data: channels }, { data: arena }] = await Promise.all([
    supabase.from('models').select('id, name, slug, context_window').eq('slug', slug).maybeSingle(),
    supabase
      .from('api_channel_prices')
      .select('input_price_per_1m, currency, is_available')
      .eq('is_available', true),
    supabase
      .from('model_benchmark_scores')
      .select('model_id, value, benchmark_metrics!inner(name)')
      .eq('benchmark_metrics.name', 'ELO'),
  ]);

  if (!model) {
    // Fall back to a generic OG if model wasn't found — still better
    // than a broken image URL.
    return new ImageResponse(
      ogTemplate({
        kicker: isZh ? 'API 价格' : 'API Pricing',
        title: slug,
        subtitle: isZh ? '模型未找到' : 'Model not found',
        locale: isZh ? 'zh' : 'en',
      }),
      size,
    );
  }

  // Compute min USD price across the model's channels
  const modelChannels = await supabase
    .from('api_channel_prices')
    .select('input_price_per_1m, currency')
    .eq('model_id', model.id)
    .eq('is_available', true);
  const usdPrices = (modelChannels.data ?? [])
    .filter((c: any) => (c.currency ?? 'USD') === 'USD' && typeof c.input_price_per_1m === 'number' && c.input_price_per_1m > 0)
    .map((c: any) => c.input_price_per_1m as number)
    .sort((a: number, b: number) => a - b);
  const lowest = usdPrices[0];
  const channelCount = modelChannels.data?.length ?? 0;

  const eloRow = (arena ?? []).find((a: any) => a.model_id === model.id);
  const elo = eloRow?.value as number | undefined;

  const stats: { label: string; value: string }[] = [];
  if (channelCount > 0) {
    stats.push({ label: isZh ? '渠道' : 'Channels', value: String(channelCount) });
  }
  if (lowest != null) {
    stats.push({
      label: isZh ? '最低 / 1M' : 'From / 1M',
      value: `$${lowest < 1 ? lowest.toFixed(2) : lowest.toFixed(1)}`,
    });
  }
  if (elo != null) {
    stats.push({ label: isZh ? 'Arena ELO' : 'Arena ELO', value: String(Math.round(elo)) });
  }

  const subtitle = isZh
    ? `${model.context_window?.toLocaleString() ?? '?'} token 上下文 · ${channelCount} 个渠道价格对比`
    : `${model.context_window?.toLocaleString() ?? '?'} token context · ${channelCount} channels compared`;

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? 'API 价格' : 'API Pricing',
      title: model.name,
      subtitle,
      stats,
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
