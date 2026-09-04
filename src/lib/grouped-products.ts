import { sql } from '@/lib/db';
import { attachPrimaryProvidersToModels } from '@/lib/schema-adapters';
import type { CurrencyCode, PriceUnit } from '@/lib/currency';
import { benchmarkKey, type ModelBenchmarkScore } from '@/lib/benchmarks';

/**
 * Builds the /api-pricing payload: every model of a given type, grouped by base
 * name, with all of its available channel prices attached.
 *
 * This used to live inside `app/api/products/grouped/route.ts` and was reachable
 * only over HTTP, which forced /api-pricing to fetch it from an effect in the
 * browser. That left the site's core SEO page serving 63 characters and a
 * spinner to crawlers. The page is a server component now and calls this
 * directly; the route stays as a thin wrapper so its contract is unchanged.
 */

export interface ChannelPrice {
  id: number;
  model_id: number;
  provider_id: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  cached_input_price_per_1m?: number | null;
  currency: CurrencyCode;
  price_unit: PriceUnit;
  rate_limit?: string | null;
  is_available?: boolean;
  providers: {
    id: number;
    name: string;
    slug: string;
    logo?: string | null;
    logo_url?: string | null;
    type: string;
    region: string;
    access_from_china: boolean;
    website?: string | null;
    pricing_url?: string | null;
    invite_url?: string | null;
  };
}

export interface GroupedProduct {
  id: number;
  name: string;
  slug: string;
  provider_ids: number[];
  context_window: number;
  benchmark_arena_elo: number | null;
  benchmarks: ModelBenchmarkScore[];
  released_at: string | null;
  created_at: string | null;
  providers?: {
    id: number;
    name: string;
    slug: string;
    logo: string;
    logo_url?: string;
    region?: string;
    access_from_china?: boolean;
  };
  baseName: string;
  versions: ChannelPrice[];
  hasChinaVersion: boolean;
  hasGlobalVersion: boolean;
  versionCounts: number;
}

export async function getGroupedProducts(type?: string | null): Promise<GroupedProduct[]> {
  // 获取所有 LLM 产品及其渠道价格
  const [modelsData, channelPrices, benchmarkScores] = await Promise.all([
    sql<any[]>`
      SELECT id, name, slug, provider_ids, context_window, released_at, created_at
      FROM models
      WHERE type = ${type || 'llm'}
      ORDER BY name
    `,
    sql<any[]>`
      SELECT
        cp.id,
        cp.model_id,
        cp.provider_id,
        cp.input_price_per_1m,
        cp.output_price_per_1m,
        cp.cached_input_price_per_1m,
        cp.currency,
        cp.price_unit,
        cp.rate_limit,
        cp.is_available,
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'logo', p.logo,
          'logo_url', p.logo_url,
          'type', p.type,
          'region', p.region,
          'access_from_china', p.access_from_china,
          'website', p.website,
          'pricing_url', p.pricing_url,
          'invite_url', p.invite_url
        ) AS providers
      FROM api_channel_prices cp
      JOIN providers p ON p.id = cp.provider_id
      WHERE cp.is_available = true
    `,
    // Fetch all current scores with their complete identity. Keeping benchmark,
    // version, task and metric together prevents unlike evaluation runs from
    // becoming a single ambiguous number in the comparison UI.
    sql<any[]>`
      SELECT s.model_id, m.slug AS source_model_slug, s.value,
             b.slug AS benchmark_slug, b.name AS benchmark_name,
             b.type AS benchmark_type, b.offical_url AS official_url,
             bv.version_label, bt.name AS task_name,
             bm.name AS metric_name, bm.unit, bm.higher_better,
             s.release_date
      FROM model_benchmark_scores s
      JOIN models m ON m.id = s.model_id
      JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
      JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id
        AND bv.is_current = true
      JOIN benchmarks b ON b.id = bv.benchmark_id
      JOIN benchmark_metrics bm ON bm.id = s.metric_id
      WHERE s.value IS NOT NULL
      ORDER BY b.name, s.value DESC NULLS LAST
    `,
  ]);

  const products = await attachPrimaryProvidersToModels(modelsData as any[]);

  // Create benchmark map: model_id -> highest value (for arena elo)
  const benchmarkMap = new Map<number, number>();
  const benchmarksByModel = new Map<number, ModelBenchmarkScore[]>();
  benchmarkScores.forEach((bs: any) => {
    const modelId = bs.model_id;
    const value = bs.value;
    if (bs.benchmark_slug === 'arena-agent' &&
        (!benchmarkMap.has(modelId) || value > (benchmarkMap.get(modelId) || 0))) {
      benchmarkMap.set(modelId, value);
    }
    const scores = benchmarksByModel.get(modelId) || [];
    scores.push({
      benchmark_slug: bs.benchmark_slug,
      benchmark_name: bs.benchmark_name,
      benchmark_type: bs.benchmark_type,
      official_url: bs.official_url,
      version_label: bs.version_label || 'default',
      task_name: bs.task_name || 'default',
      metric_name: bs.metric_name,
      unit: bs.unit,
      higher_better: bs.higher_better !== false,
      value: Number(bs.value),
      release_date: bs.release_date,
      source_model_id: modelId,
      source_model_slug: bs.source_model_slug,
    });
    benchmarksByModel.set(modelId, scores);
  });

  // 按模型基础名称分组
  const modelGroups = new Map<string, GroupedProduct>();

  products.forEach(product => {
    // 提取基础名称（移除版本号）
    const baseName = product.name.replace(/-\d{4}-\d{2}-\d{2}$/, '')
      .replace(/-\d{4}$/, '')
      .replace(/-\d+\.\d+\.\d+$/, '')
      .replace(/-\d+$/, '')
      .replace(/-\d+-$/, '');

    const productPrices = channelPrices.filter(cp => cp.model_id === product.id);
    const officialProducer =
      productPrices.find(cp => cp.providers?.type === 'producer') ||
      productPrices.find(cp => cp.providers?.type === 'official') ||
      null;
    const displayProvider = (product as any).providers || officialProducer?.providers || null;

    if (!modelGroups.has(baseName)) {
      const hasChinaVersion = productPrices.some(cp => (cp as any).providers?.region === 'china');
      const hasGlobalVersion = productPrices.some(cp => (cp as any).providers?.region === 'global');

      // (A cheapest-first ordering used to be computed here and never read.
      // It compared input_price_per_1m across currencies, so it would have
      // ranked ¥3 above $0.78; /api-pricing now normalises to USD itself.)

      modelGroups.set(baseName, {
        id: product.id,
        name: product.name,
        slug: product.slug,
        provider_ids: product.provider_ids,
        context_window: (product as any).context_window,
        benchmark_arena_elo: benchmarkMap.get(product.id) || null,
        benchmarks: benchmarksByModel.get(product.id) || [],
        released_at: product.released_at ?? null,
        created_at: product.created_at ?? null,
        providers: displayProvider,
        baseName,
        versions: productPrices as ChannelPrice[],
        hasChinaVersion,
        hasGlobalVersion,
        versionCounts: productPrices.length,
      });
    } else {
      // 合并到现有组
      const group = modelGroups.get(baseName)!;
      const productPrices = channelPrices.filter(cp => cp.model_id === product.id);
      group.versions.push(...(productPrices as ChannelPrice[]));
      group.versionCounts += productPrices.length;

      const merged = new Map(group.benchmarks.map((score) => [benchmarkKey(score), score]));
      for (const score of benchmarksByModel.get(product.id) || []) {
        const key = benchmarkKey(score);
        const existing = merged.get(key);
        if (!existing || (score.higher_better ? score.value > existing.value : score.value < existing.value)) {
          merged.set(key, score);
        }
      }
      group.benchmarks = [...merged.values()];
      const groupArena = group.benchmarks.filter((score) => score.benchmark_slug === 'arena-agent');
      group.benchmark_arena_elo = groupArena.length
        ? Math.max(...groupArena.map((score) => score.value))
        : group.benchmark_arena_elo;

      if (!group.hasChinaVersion && productPrices.some(cp => cp.providers.region === 'china')) {
        group.hasChinaVersion = true;
      }
      if (!group.hasGlobalVersion && productPrices.some(cp => cp.providers.region === 'global')) {
        group.hasGlobalVersion = true;
      }
    }
  });

  // Filter out models that have no channel prices at all. These show up
  // with a provider name in the card header but an empty comparison table
  // underneath — confusing for /api-pricing viewers who expect price
  // data. Such models still exist and are reachable via /models/[slug]
  // (which reads from a different API), so nothing is lost.
  return Array.from(modelGroups.values())
    .filter((group) => group.versions.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
