/** Zhipu China GLM Coding Plan scraper. */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const URL = 'https://bigmodel.cn/glm-coding';

export async function scrapeZhipuPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Zhipu AI China subscription plans...');
  const result = await fetchHTMLSmart(URL, { waitForTimeout: 3000 });
  if (!result.success || !result.data) {
    return { source: 'Zhipu-Plans', success: false, plans: [], errors: [result.error || 'No HTML returned'] };
  }

  const text = stripHtml(result.data);
  const rows = [
    extractTier(text, 'Lite', 'Pro', 'glm-coding-lite', 'GLM Coding Lite', 'basic'),
    extractTier(text, 'Pro', 'Max', 'glm-coding-pro', 'GLM Coding Pro', 'pro'),
    extractTier(text, 'Max', 'GLM-', 'glm-coding-max', 'GLM Coding Max', 'enterprise'),
  ];
  if (rows.some(row => row == null)) {
    return { source: 'Zhipu-Plans', success: false, plans: [], errors: ['Lite/Pro/Max monthly prices not found'] };
  }

  const plans: ScrapedPlan[] = rows.map(row => {
    const item = row!;
    return {
      planName: item.name,
      planSlug: item.slug,
      priceMonthly: item.price,
      priceYearly: Math.round(item.price * 12 * 0.7 * 100) / 100,
      pricingModel: 'subscription',
      tier: item.tier,
      features: [],
      region: 'china',
      accessFromChina: true,
      paymentMethods: ['Alipay', 'WeChat Pay'],
      isOfficial: true,
      currency: 'CNY',
    };
  });
  return { source: 'Zhipu-Plans', success: true, plans };
}

function extractTier(text: string, start: string, end: string, slug: string, name: string, tier: ScrapedPlan['tier']) {
  const section = text.match(new RegExp(`${start}[\\s\\S]*?(?=${end})`, 'i'))?.[0];
  const prices = section ? [...section.matchAll(/¥\s*([\d.]+)\s*\/月/g)].map(match => Number(match[1])) : [];
  const regularPrice = prices.length > 0 ? Math.max(...prices) : null;
  return regularPrice == null ? null : { slug, name, tier, price: regularPrice };
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#xA0;/gi, ' ').replace(/&yen;|&#165;/gi, '¥')
    .replace(/\s+/g, ' ').trim();
}

if (require.main === module) scrapeZhipuPlans().then(result => console.log(JSON.stringify(result, null, 2)));
