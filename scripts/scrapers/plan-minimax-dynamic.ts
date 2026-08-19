/** MiniMax China Token Plan scraper (current Plus / Max / Ultra lineup). */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const URL = 'https://platform.minimaxi.com/docs/guides/pricing-token-plan';

export async function scrapeMinimaxPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Minimax China subscription plans...');
  const result = await fetchHTMLSmart(URL, { waitForTimeout: 3000 });
  if (!result.success || !result.data) {
    return { source: 'Minimax-Plans', success: false, plans: [], errors: [result.error || 'No HTML returned'] };
  }

  const text = stripHtml(result.data);
  const match = text.match(/Plus\s+Max\s+Ultra\s+价格\s*¥\s*([\d.]+)\s*\/月\s*¥\s*([\d.]+)\s*\/月\s*¥\s*([\d.]+)\s*\/月/i);
  if (!match) {
    return { source: 'Minimax-Plans', success: false, plans: [], errors: ['Current Plus/Max/Ultra price row not found'] };
  }

  const tiers = [
    { slug: 'minimax-token-plus', name: 'MiniMax Token Plan Plus', tier: 'pro' as const, price: Number(match[1]) },
    { slug: 'minimax-token-max', name: 'MiniMax Token Plan Max', tier: 'team' as const, price: Number(match[2]) },
    { slug: 'minimax-token-ultra', name: 'MiniMax Token Plan Ultra', tier: 'enterprise' as const, price: Number(match[3]) },
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

  console.log(`📦 Found ${plans.length} plans from Minimax China`);
  return { source: 'Minimax-Plans', success: true, plans };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#xA0;/gi, ' ')
    .replace(/&yen;|&#165;/gi, '¥')
    .replace(/\s+/g, ' ')
    .trim();
}

if (require.main === module) {
  scrapeMinimaxPlans().then(result => console.log(JSON.stringify(result, null, 2)));
}
