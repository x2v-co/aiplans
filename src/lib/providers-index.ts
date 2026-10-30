import { currentPlanCondition } from './plan-lifecycle-query';
import { sql } from '@/lib/db';
import type { Locale } from '@/lib/seo';

export type ProviderIndexRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  logo_url: string | null;
  region: string | null;
  type: string | null;
  model_count: number;
};

/**
 * Providers that have useful detail pages: at least one plan, or a live API
 * channel on a non-shutdown model. Same inclusion rule as the sitemap.
 *
 * model_count counts active models tied via ownership, plan mapping, or a live
 * API channel so the card number matches what the detail page actually shows.
 */
export async function getProvidersForIndex(): Promise<ProviderIndexRow[]> {
  return sql<ProviderIndexRow[]>`
    SELECT
      providers.id,
      providers.name,
      providers.slug,
      providers.description,
      providers.logo,
      providers.logo_url,
      providers.region,
      providers.type,
      (
        SELECT COUNT(DISTINCT m.id)::int
        FROM models m
        WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
          AND (
            providers.id = ANY(COALESCE(m.provider_ids, ARRAY[]::integer[]))
            OR EXISTS (
              SELECT 1 FROM model_offical mo
              WHERE mo.model_id = m.id AND mo.producer_id = providers.id
            )
            OR EXISTS (
              SELECT 1 FROM model_plan_mapping mpm
              JOIN plans pl ON pl.id = mpm.plan_id
              WHERE mpm.model_id = m.id AND pl.provider_id = providers.id
                AND ${currentPlanCondition('pl')}
            )
            OR EXISTS (
              SELECT 1 FROM api_channel_prices cp
              WHERE cp.model_id = m.id
                AND cp.provider_id = providers.id
                AND cp.is_available = true
            )
          )
      ) AS model_count
    FROM providers
    WHERE EXISTS (SELECT 1 FROM plans WHERE plans.provider_id = providers.id AND ${currentPlanCondition()})
       OR EXISTS (
         SELECT 1 FROM api_channel_prices cp
         WHERE cp.provider_id = providers.id AND cp.is_available = true
           AND EXISTS (
             SELECT 1 FROM models m
             WHERE m.id = cp.model_id
               AND (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
           )
       )
    ORDER BY providers.priority ASC NULLS LAST, model_count DESC, providers.name ASC
  `;
}

export function buildProvidersIndexCopy(locale: Locale, providerCount: number): {
  title: string;
  description: string;
  heading: string;
  intro: string;
  listHeading: string;
  empty: string;
  modelCount: (n: number) => string;
  viewProvider: string;
  breadcrumb: string;
} {
  if (locale === 'zh') {
    return {
      title: `AI 供应商目录 · ${providerCount} 家 · API 与订阅套餐 | aiplans.dev`,
      description: `浏览 ${providerCount} 家 AI 供应商，查看官方 logo、覆盖模型数，并进入各供应商详情页对比 API 价格与订阅套餐。`,
      heading: 'AI 供应商目录',
      intro: '按供应商浏览 API 渠道与订阅套餐。每个卡片展示官方 logo、名称和当前覆盖的模型数，点击进入详情页。',
      listHeading: '全部供应商',
      empty: '暂无供应商数据。',
      modelCount: (n) => `${n} 个模型`,
      viewProvider: '查看详情',
      breadcrumb: '供应商',
    };
  }
  return {
    title: `AI Provider Directory · ${providerCount} providers · API & plans | aiplans.dev`,
    description: `Browse ${providerCount} AI providers with logos and model coverage, then open each provider page for API pricing and subscription plans.`,
    heading: 'AI provider directory',
    intro: 'Browse providers for API channels and subscription plans. Each card shows the logo, name and model coverage; open any card for the full provider page.',
    listHeading: 'All providers',
    empty: 'No providers available yet.',
    modelCount: (n) => `${n} ${n === 1 ? 'model' : 'models'}`,
    viewProvider: 'View provider',
    breadcrumb: 'Providers',
  };
}
