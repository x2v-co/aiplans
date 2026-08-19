/** Google Gemini consumer plan scraper using official regional prices. */
import { chromium } from 'playwright';
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';

const URL = 'https://gemini.google/subscriptions';

export async function scrapeGoogleGeminiPlans(): Promise<PlanScraperResult> {
  console.log('🔄 Fetching Google Gemini subscription plans...');
  const browser = await chromium.launch({ headless: true });
  let body = '';
  try {
    const page = await browser.newPage({ locale: 'en-SG' });
    const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response?.ok()) {
      return { source: 'GoogleGemini-Plans', success: false, plans: [], errors: [`HTTP ${response?.status() ?? 'no response'}`] };
    }
    await page.waitForFunction(
      () => /Google AI Plus/i.test(document.body.innerText) && /Google AI Pro/i.test(document.body.innerText)
        && /Google AI Ultra/i.test(document.body.innerText),
      undefined,
      { timeout: 15_000 }
    );
    body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  } catch (error) {
    return { source: 'GoogleGemini-Plans', success: false, plans: [], errors: [String(error)] };
  } finally {
    await browser.close();
  }

  const currency = body.match(/\b(SGD|USD|JPY|KRW|EUR|GBP|CNY)\s*0\s*\/\s*month/i)?.[1]?.toUpperCase();
  if (currency !== 'SGD') {
    return {
      source: 'GoogleGemini-Plans', success: false, plans: [],
      errors: [`Unsupported or missing regional currency: ${currency || 'unknown'}`],
    };
  }

  const definitions = [
    { start: 'Free', end: 'Google AI Plus', slug: 'gemini-free', name: 'Gemini Free', tier: 'free' as const },
    { start: 'Google AI Plus', end: 'Google AI Pro', slug: 'google-ai-plus', name: 'Google AI Plus', tier: 'basic' as const },
    { start: 'Google AI Pro', end: 'Google AI Ultra', slug: 'gemini-advanced', name: 'Google AI Pro', tier: 'pro' as const },
    { start: 'Google AI Ultra', end: 'Looking for AI solutions', slug: 'google-ai-ultra', name: 'Google AI Ultra', tier: 'enterprise' as const },
  ];

  const plans: ScrapedPlan[] = [];
  for (const definition of definitions) {
    const section = body.match(new RegExp(`${definition.start}[\\s\\S]*?(?=${definition.end})`, 'i'))?.[0];
    const price = section?.match(new RegExp(`${currency}\\s*([\\d.]+)\\s*\\/\\s*month`, 'i'));
    if (!price) {
      return { source: 'GoogleGemini-Plans', success: false, plans: [], errors: [`Price not found for ${definition.name}`] };
    }
    plans.push({
      planName: definition.name,
      planSlug: definition.slug,
      priceMonthly: Number(price[1]),
      priceYearly: null,
      pricingModel: 'subscription',
      tier: definition.tier,
      features: [],
      region: 'global',
      accessFromChina: false,
      paymentMethods: ['Credit Card', 'Debit Card', 'Google Pay'],
      isOfficial: true,
      currency: 'SGD',
    });
  }

  console.log(`📦 Found ${plans.length} Google plans in ${currency}`);
  return { source: 'GoogleGemini-Plans', success: true, plans };
}

if (require.main === module) scrapeGoogleGeminiPlans().then(result => console.log(JSON.stringify(result, null, 2)));
