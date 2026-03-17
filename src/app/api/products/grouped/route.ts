import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 获取按模型基础名称分组的 API 定价
 * 同一模型可能同时有国内版和国际版，需要一起返回
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // 获取所有 LLM 产品及其渠道价格
    const [modelsRes, channelPricesRes, benchmarkRes] = await Promise.all([
      supabase
        .from('models')
        .select(`
          id,
          name,
          slug,
          provider_ids,
          context_window
        `)
        .eq('type', 'llm')
        .order('name'),
      supabase
        .from('api_channel_prices')
        .select(`
          id,
          model_id,
          provider_id,
          input_price_per_1m,
          output_price_per_1m,
          cached_input_price_per_1m,
          currency,
          price_unit,
          rate_limit,
          is_available,
          providers:provider_id (
            id,
            name,
            slug,
            type,
            region,
            access_from_china
          )
        `)
        .eq('is_available', true)
        .not('provider_id', 'is', null),
      // Fetch benchmark scores from model_benchmark_scores table
      supabase
        .from('model_benchmark_scores')
        .select('model_id, value, benchmark_tasks!inner(benchmark_id)')
        .order('value', { ascending: false }),
    ]);

    if (modelsRes.error || !modelsRes.data) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }

    const products = modelsRes.data || [];
    const channelPrices = (channelPricesRes.data || []) as any[];
    const benchmarkScores = (benchmarkRes.data || []) as any[];

    // Create benchmark map: model_id -> highest value (for arena elo)
    const benchmarkMap = new Map<number, number>();
    benchmarkScores.forEach((bs: any) => {
      const modelId = bs.model_id;
      const value = bs.value;
      if (!benchmarkMap.has(modelId) || value > (benchmarkMap.get(modelId) || 0)) {
        benchmarkMap.set(modelId, value);
      }
    });

    // Fetch providers for all models
    const allProviderIds = [...new Set(products.flatMap((p: any) => p.provider_ids || []))];
    const { data: providersData } = await supabase
      .from('providers')
      .select('id, name, slug, logo, region')
      .in('id', allProviderIds);

    const providerMap = new Map((providersData || []).map((p: any) => [p.id, p]));

    // Attach first provider to each product
    products.forEach((p: any) => {
      p.providers = p.provider_ids?.[0] ? providerMap.get(p.provider_ids[0]) : null;
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

      if (!modelGroups.has(baseName)) {
        // 添加该产品的渠道价格
        const productPrices = channelPrices.filter(cp => cp.model_id === product.id);

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
          providers: (product as any).providers,
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

    // 转换为数组
    const groupedData = Array.from(modelGroups.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(groupedData);
  } catch (error) {
    console.error('Error fetching grouped products:', error);
    return NextResponse.json({ error: 'Failed to fetch grouped products' }, { status: 500 });
  }
}
