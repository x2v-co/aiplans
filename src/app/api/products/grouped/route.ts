import { NextResponse } from 'next/server';
import { getGroupedProducts } from '@/lib/grouped-products';

/**
 * 获取按模型基础名称分组的 API 定价
 * 同一模型可能同时有国内版和国际版，需要一起返回
 *
 * The payload builder lives in src/lib/grouped-products.ts so the /api-pricing
 * server component can call it without going through HTTP.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    return NextResponse.json(await getGroupedProducts(type));
  } catch (error) {
    console.error('Error fetching grouped products:', error);
    return NextResponse.json({ error: 'Failed to fetch grouped products' }, { status: 500 });
  }
}
