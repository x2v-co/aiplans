import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { attachPrimaryProvidersToModels } from '@/lib/schema-adapters';

/**
 * 获取按模型基础名称分组的 API 定价
 * 同一模型可能同时有国内版和国际版，需要一起返回
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // 获取所有 LLM 产品及其渠道价格
    const [modelsData, channelPrices, benchmarkScores] = await Promise.all([
      sql<any[]>`
        SELECT id, name, slug, provider_ids, context_window
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
            'access_from_china', p.access_from_china
          ) AS providers
        FROM api_channel_prices cp
        JOIN providers p ON p.id = cp.provider_id
        WHERE cp.is_available = true
      `,
      // Fetch Arena ELO scores specifically. Older version of this query
      // tried to join through `benchmark_tasks.benchmark_id` which doesn't
      // exist (the column is `benchmark_version_id`), so the whole query
      // silently returned 0 rows — meaning every product had
      // `benchmark_arena_elo: null` and "sort by performance" was a no-op
      // for all 271 products. Join through benchmark_metrics and filter
      // on name='ELO' so we get actual Chatbot Arena ratings.
      sql<any[]>`
        SELECT s.model_id, s.value
        FROM model_benchmark_scores s
        JOIN benchmark_metrics bm ON bm.id = s.metric_id
        WHERE bm.name = 'ELO'
        ORDER BY s.value DESC NULLS LAST
      `,
    ]);

    const products = await attachPrimaryProvidersToModels(modelsData as any[]);

    // Create benchmark map: model_id -> highest value (for arena elo)
    const benchmarkMap = new Map<number, number>();
    benchmarkScores.forEach((bs: any) => {
      const modelId = bs.model_id;
      const value = bs.value;
      if (!benchmarkMap.has(modelId) || value > (benchmarkMap.get(modelId) || 0)) {
        benchmarkMap.set(modelId, value);
      }
    });

    // 按模型基础名称分组
    const modelGroups = new Map<string, {
      id: number;
      name: string;
      slug: string;
      provider_ids: number[];
      context_window: number | null;
      benchmark_arena_elo: number | null;
      providers: {
        id: number;
        name: string;
        slug: string;
        logo: string | null;
        region?: string;
      } | null;
      baseName: string;
      versions: typeof channelPrices[];
      hasChinaVersion: boolean;
      hasGlobalVersion: boolean;
      versionCounts: number;
    }>();

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

        // 按价格排序找到最便宜的
        const sortedByPrice = [...productPrices].sort((a, b) =>
          (a.input_price_per_1m || Infinity) - (b.input_price_per_1m || Infinity)
        );

        modelGroups.set(baseName, {
          id: product.id,
          name: product.name,
          slug: product.slug,
          provider_ids: product.provider_ids,
          context_window: product.context_window,
          benchmark_arena_elo: benchmarkMap.get(product.id) || null,
          providers: displayProvider,
          baseName,
          versions: productPrices as any,
          hasChinaVersion,
          hasGlobalVersion,
          versionCounts: productPrices.length,
        });
      } else {
        // 合并到现有组
        const group = modelGroups.get(baseName)!;
        const productPrices = channelPrices.filter(cp => cp.model_id === product.id);
        group.versions.push(...productPrices);
        group.versionCounts += productPrices.length;

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
    const groupedData = Array.from(modelGroups.values())
      .filter((group) => group.versions.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(groupedData);
  } catch (error) {
    console.error('Error fetching grouped products:', error);
    return NextResponse.json({ error: 'Failed to fetch grouped products' }, { status: 500 });
  }
}
