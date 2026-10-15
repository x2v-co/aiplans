/** US Google AI tiers; never relabel an ambiguous regional $ price as USD. */
import { chromium } from 'playwright';
import type { PlanScraperResult, ScrapedPlan } from '../utils/plan-validator';

const URL = 'https://gemini.google/subscriptions/';
export const GOOGLE_UNVERIFIED_NOTE = '[needs-verification] Plus/Pro US price not identified on the page; prices withheld. Source: ' + URL;

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
  const us = /\bUSD\b|US\$|United States/i.test(body) && !/\bSGD\b|S\$/i.test(body);
  // Plus/Pro: only an explicit US page price within that plan's own section; else withheld.
  // First heading occurrence whose own card (up to the next plan heading) carries a monthly price.
  const priceAfterHeading = (name: string) => {
    for (const match of body.matchAll(new RegExp(`${name}(?! is available| ?&| and)`, 'gi'))) {
      const rest = body.slice(match.index! + match[0].length);
      const end = rest.search(/Google AI (?:Plus|Pro|Ultra)(?! is available)/i);
      const card = end < 0 ? rest : rest.slice(0, end);
      const price = card.match(/(?:USD\s*|US\$\s*|\$\s*)(\d+(?:\.\d{2})?)\s*\/\s*month/i);
      if (price && Number(price[1]) > 0) return us ? Number(price[1]) : null;
    }
    return null;
  };
  const plusPrice = priceAfterHeading('Google AI Plus');
  const proPrice = priceAfterHeading('Google AI Pro');
  const tierRow = (planName: string, planSlug: string, tier: 'basic' | 'pro', price: number | null): ScrapedPlan => price == null
    ? { ...common, planName, planSlug, tier, priceMonthly: null, currency: null, region: 'needs-verification', notes: GOOGLE_UNVERIFIED_NOTE }
    : { ...common, planName, planSlug, tier, priceMonthly: price, currency: 'USD', region: 'US', notes: `US consumer tier. Source: ${URL}` };
  const plans: ScrapedPlan[] = [
    tierRow('Google AI Plus', 'google-ai-plus', 'basic', plusPrice),
    // gemini-advanced is the historical slug of Google AI Pro.
    tierRow('Google AI Pro', 'gemini-advanced', 'pro', proPrice),
  ];
  const ultra = body.match(/Google AI Ultra[\s\S]*?(?=Google AI Ultra is available|Looking for AI solutions|$)/i)?.[0] ?? '';
  // Explicit USD/US$ or an explicit United States region is required; locale alone isn't proof.
  for (const [multiplier, expected] of [[5, 99.99], [20, 199.99]] as const) {
    const price = new RegExp(`(?:USD\\s*|US\\$\\s*|\\$\\s*)${String(expected).replace('.', '\\.')}\\s*\\/\\s*month\\s*:?\\s*${multiplier}x\\b`, 'i');
    if (!us || !price.test(ultra)) continue;
    plans.push({ ...common, planName: `Google AI Ultra (${multiplier}x)`, planSlug: `google-ai-ultra-${multiplier}x`,
      priceMonthly: expected, tier: 'pro', currency: 'USD', region: 'US',
      features: [`${multiplier}x`], notes: `US ${multiplier}x tier. Source: ${URL}` });
  }
  const complete = plans.length === 4 && plusPrice != null && proPrice != null;
  return { source: 'GoogleGemini-Plans', success: true, plans,
    ...(complete ? {} : { errors: ['US Plus/Pro/Ultra prices not all identified; no regional price substituted.'] }) };
}

if (require.main === module) scrapeGoogleGeminiPlans().then(result => console.log(JSON.stringify(result, null, 2)));
