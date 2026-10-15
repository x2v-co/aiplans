/** MiniMax China M Plan scraper (Go / Explore / Build; replaced Token Plan Plus/Max/Ultra in 2026-10). */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { parseMPlanPrices } from './lib/minimax-mplan';

const URL = 'https://platform.minimaxi.com/docs/m-plan/monthly-offer.md';

export function buildMinimaxPlans(markdown: string): PlanScraperResult {
  const prices = parseMPlanPrices(markdown, 'CNY');
  if (!prices) {
    return { source: 'Minimax-Plans', success: false, plans: [], errors: ['M Plan Go/Explore/Build regular price rows not found'] };
  }
  const tiers = [
    { slug: 'minimax-mplan-go', name: 'MiniMax M Plan Go', tier: 'basic' as const, price: prices.Go },
    { slug: 'minimax-mplan-explore', name: 'MiniMax M Plan Explore', tier: 'pro' as const, price: prices.Explore },
    { slug: 'minimax-mplan-build', name: 'MiniMax M Plan Build', tier: 'pro' as const, price: prices.Build },
  ];
  const plans: ScrapedPlan[] = tiers.map(item => ({
    planName: item.name,
    planSlug: item.slug,
    priceMonthly: item.price,
    priceYearly: null,
    pricingModel: 'subscription',
    tier: item.tier,
    features: [],
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    isOfficial: true,
    currency: 'CNY',
  }));
  return { source: 'Minimax-Plans', success: true, plans };
}

export async function scrapeMinimaxPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Minimax China M Plan prices...');
  try {
    const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (aiplans planprice scraper)' } });
    if (!res.ok) return { source: 'Minimax-Plans', success: false, plans: [], errors: [`HTTP ${res.status} for ${URL}`] };
    const result = buildMinimaxPlans(await res.text());
    console.log(`📦 Found ${result.plans.length} plans from Minimax China`);
    return result;
  } catch (error) {
    return { source: 'Minimax-Plans', success: false, plans: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
}

if (require.main === module) {
  scrapeMinimaxPlans().then(result => console.log(JSON.stringify(result, null, 2)));
}
