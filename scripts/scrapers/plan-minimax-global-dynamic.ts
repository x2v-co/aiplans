/** MiniMax Global M Plan scraper (Go / Explore / Build; replaced Token Plan Plus/Max/Ultra in 2026-10). */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { parseMPlanPrices } from './lib/minimax-mplan';

const URL = 'https://platform.minimax.io/docs/m-plan/monthly-offer.md';

export function buildMinimaxGlobalPlans(markdown: string): PlanScraperResult {
  const prices = parseMPlanPrices(markdown, 'USD');
  if (!prices) {
    return { source: 'MinimaxGlobal-Plans', success: false, plans: [], errors: ['M Plan Go/Explore/Build regular price rows not found'] };
  }
  const tiers = [
    { slug: 'minimax-global-mplan-go', name: 'MiniMax Global M Plan Go', tier: 'basic' as const, price: prices.Go },
    { slug: 'minimax-global-mplan-explore', name: 'MiniMax Global M Plan Explore', tier: 'pro' as const, price: prices.Explore },
    { slug: 'minimax-global-mplan-build', name: 'MiniMax Global M Plan Build', tier: 'pro' as const, price: prices.Build },
  ];
  const plans: ScrapedPlan[] = tiers.map(item => ({
    planName: item.name,
    planSlug: item.slug,
    priceMonthly: item.price,
    priceYearly: null,
    pricingModel: 'subscription',
    tier: item.tier,
    features: [],
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    isOfficial: true,
    currency: 'USD',
  }));
  return { source: 'MinimaxGlobal-Plans', success: true, plans };
}

export async function scrapeMinimaxGlobalPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Minimax Global M Plan prices...');
  try {
    const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (aiplans planprice scraper)' } });
    if (!res.ok) return { source: 'MinimaxGlobal-Plans', success: false, plans: [], errors: [`HTTP ${res.status} for ${URL}`] };
    const result = buildMinimaxGlobalPlans(await res.text());
    console.log(`📦 Found ${result.plans.length} plans from Minimax Global`);
    return result;
  } catch (error) {
    return { source: 'MinimaxGlobal-Plans', success: false, plans: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
}

if (require.main === module) {
  scrapeMinimaxGlobalPlans().then(result => console.log(JSON.stringify(result, null, 2)));
}
