import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ogTemplate, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-template';
import { sql } from '@/lib/db';
import { decodeSlugParam } from '@/lib/route-params';

export const alt = 'Provider API Models, Pricing & Subscription Plans — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const [provider] = await sql<Array<{ id: number; name: string }>>`
    SELECT id, name FROM providers WHERE slug = ${decodeSlugParam(slug)} LIMIT 1
  `;
  if (!provider) notFound();
  const [counts] = await sql<Array<{ plans: number; models: number }>>`
    SELECT
      (SELECT count(*)::int FROM plans WHERE provider_id = ${provider.id}) AS plans,
      (SELECT count(DISTINCT model_id)::int FROM api_channel_prices
        WHERE provider_id = ${provider.id} AND is_available = true
          AND EXISTS (SELECT 1 FROM models m WHERE m.id = model_id
            AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date))) AS models
  `;
  const t = await getTranslations({ locale, namespace: 'providerPage' });
  return new ImageResponse(ogTemplate({
    kicker: locale === 'zh' ? '供应商' : 'Provider',
    title: provider.name,
    subtitle: t('metaDescription', { name: provider.name }),
    stats: [
      { label: t('plans'), value: String(counts.plans) },
      { label: t('apiModels'), value: String(counts.models) },
    ],
    locale: locale === 'zh' ? 'zh' : 'en',
  }), size);
}

export const dynamic = 'force-dynamic';
