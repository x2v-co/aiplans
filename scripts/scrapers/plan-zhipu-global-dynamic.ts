/** Z.AI global GLM Coding Plan scraper. */
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';
import { chromium } from 'playwright';

const URL = 'https://z.ai/subscribe';

export async function scrapeZhipuGlobalPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Zhipu AI Global subscription plans...');
  const browser = await chromium.launch({ headless: true });
  let text = '';
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await browser.newPage({ locale: 'en-US' });
      try {
        const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        if (!response?.ok()) continue;
        await page.waitForFunction(
          () => /Lite/i.test(document.body.innerText) && /Pro/i.test(document.body.innerText)
            && /Max/i.test(document.body.innerText) && /\$\s*\d/.test(document.body.innerText),
          undefined,
          { timeout: 15_000 }
        );
        text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
        break;
      } catch (error) {
        if (attempt === 3) {
          return {
            source: 'ZhipuGlobal-Plans',
            success: false,
            plans: [],
            errors: [`Pricing content did not load after 3 attempts: ${String(error)}`],
          };
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const rows = [
    extractTier(text, 'Lite', 'Pro', 'z-ai-lite', 'Z.AI Lite', 'basic'),
    extractTier(text, 'Pro', 'Max', 'z-ai-pro', 'Z.AI Pro', 'pro'),
    extractTier(text, 'Max', 'Invite friends', 'z-ai-max', 'Z.AI Max', 'enterprise'),
  ];
  if (rows.some(row => row == null)) {
    return { source: 'ZhipuGlobal-Plans', success: false, plans: [], errors: ['Lite/Pro/Max monthly prices not found'] };
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
      region: 'global',
      accessFromChina: true,
      paymentMethods: ['Credit Card', 'PayPal'],
      isOfficial: true,
      currency: 'USD',
    };
  });
  return { source: 'ZhipuGlobal-Plans', success: true, plans };
}

function extractTier(text: string, start: string, end: string, slug: string, name: string, tier: ScrapedPlan['tier']) {
  const section = text.match(new RegExp(`${start}[\\s\\S]*?(?=${end})`, 'i'))?.[0];
  const prices = section ? [...section.matchAll(/\$\s*([\d.]+)\s*\/month/g)].map(match => Number(match[1])) : [];
  const regularPrice = prices.length > 0 ? Math.max(...prices) : null;
  return regularPrice == null ? null : { slug, name, tier, price: regularPrice };
}

if (require.main === module) scrapeZhipuGlobalPlans().then(result => console.log(JSON.stringify(result, null, 2)));
