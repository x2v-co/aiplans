import { sql } from '@/lib/db';
import { databaseDate } from '@/lib/pricing-seo';

export type HomeCatalogStats = {
  modelCount: number;
  channelCount: number;
  updatedOn: string | null;
};

export type HomeMetadataCopy = {
  title: { en: string; zh: string };
  description: { en: string; zh: string };
};

/** Used when the catalog query fails. Counts are never invented. */
export const FALLBACK_HOME_COPY: HomeMetadataCopy = {
  title: {
    en: 'aiplans.dev — Compare AI Pricing',
    zh: 'aiplans.dev — 全网 AI 价格对比',
  },
  description: {
    en: 'Compare GPT-4, Claude, DeepSeek, Gemini pricing across official and aggregator channels. Find the cheapest AI API.',
    zh: '对比 GPT-4、Claude、DeepSeek、Gemini 等 AI 模型在官方与聚合渠道的价格，找到最便宜的 API。',
  },
};

/**
 * Available LLM models and the channels that price them. Same availability
 * rule as the model sitemap: a shut-down model or an unavailable channel
 * does not count.
 */
export async function getHomeCatalogStats(): Promise<HomeCatalogStats | null> {
  try {
    const [row] = await sql<Array<{
      model_count: number | string;
      channel_count: number | string;
      updated_at: Date | string | null;
    }>>`
      SELECT count(DISTINCT m.id)::int AS model_count,
             count(cp.id)::int AS channel_count,
             max(cp.updated_at) AS updated_at
      FROM models m
      JOIN api_channel_prices cp ON cp.model_id = m.id AND cp.is_available = true
      WHERE (m.shutdown_date IS NULL OR m.shutdown_date > (now() AT TIME ZONE 'UTC')::date)
        AND m.type ILIKE '%llm%'
    `;
    const modelCount = Number(row?.model_count);
    const channelCount = Number(row?.channel_count);
    if (!Number.isInteger(modelCount) || !Number.isInteger(channelCount) || modelCount < 1 || channelCount < 1) {
      return null;
    }
    return { modelCount, channelCount, updatedOn: databaseDate(row?.updated_at ?? null) };
  } catch (error) {
    console.error('home: failed to load catalog stats', error);
    return null;
  }
}

export function buildHomeMetadataCopy(stats: HomeCatalogStats | null): HomeMetadataCopy {
  if (!stats) return FALLBACK_HOME_COPY;
  const { modelCount, channelCount, updatedOn } = stats;
  const enUpdated = updatedOn ? ` Pricing data updated ${updatedOn}.` : '';
  const zhUpdated = updatedOn ? `价格数据更新于 ${updatedOn}。` : '';
  return {
    title: {
      en: `Compare AI Pricing · ${modelCount} models, ${channelCount} channels | aiplans.dev`,
      zh: `AI 价格对比 · 收录 ${modelCount} 个模型、${channelCount} 个渠道 | aiplans.dev`,
    },
    description: {
      en: `Compare API token prices and subscription plans across ${modelCount} models and ${channelCount} channels.${enUpdated}`,
      zh: `对比 ${modelCount} 个模型、${channelCount} 个渠道的 API 价格与订阅套餐。${zhUpdated}`,
    },
  };
}
