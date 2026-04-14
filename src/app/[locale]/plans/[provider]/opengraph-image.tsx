import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { supabase } from '@/lib/supabase';

export const alt = 'Provider Subscription Plans — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}) {
  const { locale, provider: providerSlug } = await params;
  const isZh = locale === 'zh';

  const { data: provider } = await supabase
    .from('providers')
    .select('id, name, slug, region')
    .eq('slug', providerSlug)
    .maybeSingle();

  if (!provider) {
    return new ImageResponse(
      ogTemplate({
        kicker: isZh ? '订阅计划' : 'Subscription Plans',
        title: providerSlug,
        subtitle: isZh ? '供应商未找到' : 'Provider not found',
        locale: isZh ? 'zh' : 'en',
      }),
      size,
    );
  }

  // Plan count + cheapest price
  const { data: plans } = await supabase
    .from('plans')
    .select('price, currency')
    .eq('provider_id', provider.id);

  const priced = (plans ?? []).filter(
    (p: any) => typeof p.price === 'number' && p.price > 0,
  );
  const cheapest = priced.length
    ? priced.reduce((min: any, p: any) => (p.price < min.price ? p : min))
    : null;

  const stats: { label: string; value: string }[] = [
    { label: isZh ? '计划数' : 'Plans', value: String(plans?.length ?? 0) },
  ];
  if (cheapest) {
    const sym = cheapest.currency === 'CNY' ? '¥' : cheapest.currency === 'EUR' ? '€' : '$';
    stats.push({
      label: isZh ? '最低月付' : 'From',
      value: `${sym}${cheapest.price}`,
    });
  }
  if (provider.region === 'china') {
    stats.push({ label: isZh ? '区域' : 'Region', value: '🇨🇳 CN' });
  }

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? '订阅计划' : 'Subscription Plans',
      title: provider.name,
      subtitle: isZh
        ? `${provider.name} 所有订阅档位对比：免费、Plus、Pro、Team、企业`
        : `All ${provider.name} subscription tiers compared: Free, Plus, Pro, Team, Enterprise`,
      stats,
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
