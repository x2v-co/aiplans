import { ImageResponse } from 'next/og';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { supabase } from '@/lib/supabase';

export const alt = 'Plan Comparison — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; model: string }>;
}) {
  const { locale, model: modelSlug } = await params;
  const isZh = locale === 'zh';

  const { data: model } = await supabase
    .from('models')
    .select('id, name')
    .eq('slug', modelSlug)
    .maybeSingle();

  if (!model) {
    return new ImageResponse(
      ogTemplate({
        kicker: isZh ? '计划对比' : 'Compare Plans',
        title: modelSlug,
        subtitle: isZh ? '模型未找到' : 'Model not found',
        accent: '#10b981',
        locale: isZh ? 'zh' : 'en',
      }),
      size,
    );
  }

  // Count plans linked to this model via model_plan_mapping
  const { data: mappings } = await supabase
    .from('model_plan_mapping')
    .select('plan_id')
    .eq('model_id', model.id);

  const planIds = (mappings ?? []).map((m: any) => m.plan_id).filter(Boolean);
  const { data: plans } = planIds.length
    ? await supabase
        .from('plans')
        .select('price, currency, provider_id')
        .in('id', planIds)
    : { data: [] };

  const priced = (plans ?? []).filter(
    (p: any) => typeof p.price === 'number' && p.price > 0,
  );
  const providerCount = new Set((plans ?? []).map((p: any) => p.provider_id)).size;
  const cheapest = priced.length
    ? priced.reduce((min: any, p: any) => (p.price < min.price ? p : min))
    : null;

  const stats: { label: string; value: string }[] = [
    { label: isZh ? '计划数' : 'Plans', value: String(plans?.length ?? 0) },
    { label: isZh ? '供应商' : 'Providers', value: String(providerCount) },
  ];
  if (cheapest) {
    const sym = cheapest.currency === 'CNY' ? '¥' : cheapest.currency === 'EUR' ? '€' : '$';
    stats.push({
      label: isZh ? '最低月付' : 'From',
      value: `${sym}${cheapest.price}`,
    });
  }

  return new ImageResponse(
    ogTemplate({
      kicker: isZh ? '计划对比' : 'Compare Plans',
      title: model.name,
      subtitle: isZh
        ? `${plans?.length ?? 0} 个订阅计划覆盖 ${model.name} · 横向对比月付/年付/速率限制`
        : `${plans?.length ?? 0} subscription plans include ${model.name} · monthly vs annual vs rate limits`,
      stats,
      accent: '#10b981',
      locale: isZh ? 'zh' : 'en',
    }),
    size,
  );
}
