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
    const [productsRes, channelPricesRes] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          provider_id,
          context_window,
          benchmark_mmlu,
          benchmark_arena_elo,
          providers!inner (
            id,
            name,
            slug,
            logo_url,
            region
          )
        `)
        .eq('type', 'llm')
        .order('name'),
      supabase
        .from('channel_prices')
        .select(`
          id,
          product_id,
          channel_id,
          input_price_per_1m,
          output_price_per_1m,
          cached_input_price_per_1m,
          currency,
          price_unit,
          rate_limit,
          is_available,
          channels!inner (
            id,
            name,
            slug,
            type,
            region,
            access_from_china,
            provider_id
          )
        `)
        .eq('is_available', true),
    ]);

    if (productsRes.error || !productsRes.data) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const products = productsRes.data || [];
    const channelPrices = (channelPricesRes.data || []) as any[];

    // 按模型基础名称分组
    const modelGroups = new Map<string, {
      id: number;
      name: string;
      slug: string;
      provider_id: number;
      context_window: number | null;
      benchmark_mmlu: number | null;
      benchmark_arena_elo: number | null;
      providers: {
        id: number;
        name: string;
        slug: string;
        logo_url: string | null;
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
        const productPrices = channelPrices.filter(cp => cp.product_id === product.id);

        const hasChinaVersion = productPrices.some(cp => (cp as any).channels?.region === 'china');
        const hasGlobalVersion = productPrices.some(cp => (cp as any).channels?.region === 'global');

        // 按价格排序找到最便宜的
        const sortedByPrice = [...productPrices].sort((a, b) =>
          (a.input_price_per_1m || Infinity) - (b.input_price_per_1m || Infinity)
        );

        modelGroups.set(baseName, {
          id: product.id,
          name: product.name,
          slug: product.slug,
          provider_id: product.provider_id,
          context_window: product.context_window,
          benchmark_mmlu: product.benchmark_mmlu,
          benchmark_arena_elo: product.benchmark_arena_elo,
          providers: product.providers as any,
          baseName,
          versions: productPrices as any,
          hasChinaVersion,
          hasGlobalVersion,
          versionCounts: productPrices.length,
        });
      } else {
        // 合并到现有组
        const group = modelGroups.get(baseName)!;
        const productPrices = channelPrices.filter(cp => cp.product_id === product.id);
        group.versions.push(...productPrices);
        group.versionCounts += productPrices.length;

        if (!group.hasChinaVersion && productPrices.some(cp => cp.channels.region === 'china')) {
          group.hasChinaVersion = true;
        }
        if (!group.hasGlobalVersion && productPrices.some(cp => cp.channels.region === 'global')) {
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
