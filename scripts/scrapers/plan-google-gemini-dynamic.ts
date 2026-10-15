/** US Google AI tiers; never relabel an ambiguous regional $ price as USD. */
import { chromium } from 'playwright';
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';

const URL = 'https://gemini.google/subscriptions/';
export const GOOGLE_UNVERIFIED_NOTE = '[needs-verification] Plus/Pro region and currency unverified in 2026-10-15 audit; prices withheld. Source: ' + URL;

export async function scrapeGoogleGeminiPlans(): Promise<PlanScraperResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    const response = await page.goto(URL + '?hl=en-US', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(() => /Google AI Ultra/i.test(document.body.innerText), undefined, { timeout: 15_000 });
    return parseGooglePlansBody(await page.locator('body').innerText());
  } catch (error) {
    return { source: 'GoogleGemini-Plans', success: false, plans: [], errors: [String(error)] };
  } finally {
    await browser.close();
  }
}

export function parseGooglePlansBody(raw: string): PlanScraperResult {
  const body = raw.replace(/\s+/g, ' ').trim();
  if (!/Google AI Plus/i.test(body) || !/Google AI Pro/i.test(body)) {
    return { source: 'GoogleGemini-Plans', success: false, plans: [], errors: ['Google plan headings missing; nothing inferred from an empty or changed page.'] };
  }
  const common = { priceYearly: null, pricingModel: 'subscription' as const,
    features: [], accessFromChina: false, paymentMethods: [], isOfficial: true };
  // These two rows self-heal previously mislabelled prices even on a regional response.
  const plans: ScrapedPlan[] = [
    { ...common, planName: 'Google AI Plus', planSlug: 'google-ai-plus', tier: 'basic', priceMonthly: null,
      currency: null, region: 'needs-verification', notes: GOOGLE_UNVERIFIED_NOTE },
    { ...common, planName: 'Google AI Pro', planSlug: 'gemini-advanced', tier: 'pro', priceMonthly: null,
      currency: null, region: 'needs-verification', notes: GOOGLE_UNVERIFIED_NOTE },
  ];
  const ultra = body.match(/Google AI Ultra[\s\S]*?(?=Google AI Ultra is available|Looking for AI solutions|$)/i)?.[0] ?? '';
  // Explicit USD/US$ or an explicit United States region is required; locale alone isn't proof.
  const us = /\bUSD\b|US\$|United States/i.test(body) && !/\bSGD\b|S\$/i.test(body);
  for (const [multiplier, expected] of [[5, 99.99], [20, 199.99]] as const) {
    const price = new RegExp(`(?:USD\\s*|US\\$\\s*|\\$\\s*)${String(expected).replace('.', '\\.')}\\s*\\/\\s*month\\s*:?\\s*${multiplier}x\\b`, 'i');
    if (!us || !price.test(ultra)) continue;
    plans.push({ ...common, planName: `Google AI Ultra (${multiplier}x)`, planSlug: `google-ai-ultra-${multiplier}x`,
      priceMonthly: expected, tier: 'pro', currency: 'USD', region: 'US',
      features: [`${multiplier}x`], notes: `US ${multiplier}x tier. Source: ${URL}` });
  }
  const complete = plans.length === 4;
  return { source: 'GoogleGemini-Plans', success: true, plans,
    ...(complete ? {} : { errors: ['US Ultra 5x/20x prices not both identified; no regional price substituted.'] }) };
}

if (require.main === module) scrapeGoogleGeminiPlans().then(result => console.log(JSON.stringify(result, null, 2)));
