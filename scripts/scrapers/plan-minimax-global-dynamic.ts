/** MiniMax Global Token Plan scraper (current Plus / Max / Ultra lineup). */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const URL = 'https://platform.minimax.io/docs/guides/pricing-token-plan';

export async function scrapeMinimaxGlobalPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Minimax Global subscription plans...');
  const result = await fetchHTMLSmart(URL, { waitForTimeout: 3000 });
  if (!result.success || !result.data) {
    return { source: 'MinimaxGlobal-Plans', success: false, plans: [], errors: [result.error || 'No HTML returned'] };
  }

  const text = stripHtml(result.data);
  const match = text.match(/Plus\s+Max\s+Ultra\s+Price\s*\$\s*([\d.]+)\s*\/month\s*\$\s*([\d.]+)\s*\/month\s*\$\s*([\d.]+)\s*\/month/i);
  if (!match) {
    return { source: 'MinimaxGlobal-Plans', success: false, plans: [], errors: ['Current Plus/Max/Ultra price row not found'] };
  }

  const tiers = [
    { slug: 'minimax-global-plus', name: 'MiniMax Global Plus', tier: 'pro' as const, price: Number(match[1]) },
    { slug: 'minimax-global-max', name: 'MiniMax Global Max', tier: 'team' as const, price: Number(match[2]) },
    { slug: 'minimax-global-ultra', name: 'MiniMax Global Ultra', tier: 'enterprise' as const, price: Number(match[3]) },
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
    accessFromChina: true,
    paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
    isOfficial: true,
    currency: 'USD',
  }));

  console.log(`📦 Found ${plans.length} plans from Minimax Global`);
  return { source: 'MinimaxGlobal-Plans', success: true, plans };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#xA0;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

if (require.main === module) {
  scrapeMinimaxGlobalPlans().then(result => console.log(JSON.stringify(result, null, 2)));
}
