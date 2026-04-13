/**
 * Anthropic Claude Plan Scraper - Dynamic fetching from Claude pricing page
 * Uses Playwright for JavaScript-rendered content
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

const ANTHROPIC_PLANS_URL = 'https://claude.com/pricing';

interface AnthropicPlan {
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  dailyMessageLimit?: number;
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
}

interface ScrapedPlanData {
  name: string;
  price: string;
  description: string;
}

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/**
 * Fetch and parse Anthropic subscription plans using Playwright DOM evaluation
 */
async function fetchAnthropicPlans(): Promise<{ plans: AnthropicPlan[], errors: string[] }> {
  const errors: string[] = [];
  const plans: AnthropicPlan[] = [];

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    console.log('📄 Navigating to Anthropic pricing page...');
    await page.goto(ANTHROPIC_PLANS_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract plan data directly from DOM
    const planData: ScrapedPlanData[] = await page.evaluate(() => {
      const results: ScrapedPlanData[] = [];

      // Find all pricing cards
      const priceWraps = document.querySelectorAll('[class*="card_pricing_price_wrap"]');

      priceWraps.forEach((priceWrap) => {
        // Get the price amount element
        const priceAmount = priceWrap.querySelector('[class*="price_amount"]');
        if (!priceAmount) return;

        // Find the plan name - typically in a nearby heading or preceding element
        const card = priceWrap.closest('[class*="card"]') || priceWrap.parentElement?.parentElement;
        if (!card) return;

        // Look for plan name in headings
        const heading = card.querySelector('h1, h2, h3, h4, [class*="heading"], [class*="title"]');
        const name = heading?.textContent?.trim() || '';

        // Get price and description
        const price = priceAmount.textContent?.trim() || '';
        const description = priceWrap.textContent?.trim() || '';

        if (name && price) {
          results.push({ name, price, description });
        }
      });

      return results;
    });

    console.log('📦 Found plan data:', JSON.stringify(planData, null, 2));

    // Also try extracting from body text as fallback
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('📄 Body text preview:', bodyText.substring(0, 500));

    await page.close();

    // Parse the extracted data
    for (const data of planData) {
      const nameLower = data.name.toLowerCase();
      const priceNum = parseFloat(data.price.replace(/[^0-9.]/g, ''));

      if (isNaN(priceNum) && !nameLower.includes('enterprise')) {
        continue;
      }

      let tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise' = 'basic';
      let planName = data.name;

      if (nameLower.includes('free')) {
        tier = 'free';
        planName = 'Claude Free';
      } else if (nameLower.includes('pro')) {
        tier = 'pro';
        planName = 'Claude Pro';
      } else if (nameLower.includes('max')) {
        tier = 'pro'; // Max is a higher tier of Pro
        planName = 'Claude Max';
      } else if (nameLower.includes('team')) {
        tier = 'team';
        planName = 'Claude Team';
      } else if (nameLower.includes('enterprise')) {
        tier = 'enterprise';
        planName = 'Claude Enterprise';
      }

      // Check for multiple prices in description (annual vs monthly)
      const priceMatch = data.description.match(/\$(\d+(?:\.\d+)?)\s*(?:if\s+)?billed\s+monthly/i);
      const annualMatch = data.description.match(/\$(\d+(?:\.\d+)?)\s*billed\s+up\s+front/i);

      let priceMonthly = priceNum;
      let priceYearly: number | undefined;

      if (priceMatch && annualMatch) {
        priceMonthly = parseFloat(priceMatch[1]);
        priceYearly = parseFloat(annualMatch[1]);
      }

      plans.push({
        name: planName,
        priceMonthly,
        priceYearly,
        tier,
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: tier === 'enterprise' ? ['Invoice', 'Contract'] : ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
        accessFromChina: false,
        region: 'global',
      });
    }

    // If DOM extraction failed, try text-based extraction
    if (plans.length === 0) {
      console.log('⚠️ DOM extraction failed, trying text-based extraction...');

      // Parse from body text - pattern: Plan name -> "Try Claude" -> $price
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';
        const nextNextLine = lines[i + 2] || '';

        // Look for plan names
        if (/^(Free|Pro|Max|Team|Enterprise)$/i.test(line)) {
          // Look for price in nearby lines (within next 3 lines)
          const searchArea = [nextLine, nextNextLine, lines[i + 3] || ''].join(' ');
          const priceMatch = searchArea.match(/\$(\d+(?:\.\d+)?)/);

          if (priceMatch || line.toLowerCase() === 'enterprise') {
            const planName = `Claude ${line}`;
            let tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise' = 'basic';

            if (line.toLowerCase() === 'free') tier = 'free';
            else if (line.toLowerCase() === 'pro') tier = 'pro';
            else if (line.toLowerCase() === 'max') tier = 'pro';
            else if (line.toLowerCase() === 'team') tier = 'team';
            else if (line.toLowerCase() === 'enterprise') tier = 'enterprise';

            const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

            // Look for monthly price info in surrounding text
            const contextText = lines.slice(i, i + 10).join(' ');
            const monthlyMatch = contextText.match(/\$(\d+)\s*(?:if\s+)?billed\s+monthly/i);
            const annualMatch = contextText.match(/\$(\d+)\s*billed\s+up\s+front/i);

            let priceMonthly = price;
            let priceYearly: number | undefined;

            if (monthlyMatch) {
              priceMonthly = parseFloat(monthlyMatch[1]);
            }
            if (annualMatch) {
              priceYearly = parseFloat(annualMatch[1]);
            }

            plans.push({
              name: planName,
              priceMonthly,
              priceYearly,
              tier,
              dailyMessageLimit: undefined,
              features: [],
              paymentMethods: tier === 'enterprise' ? ['Invoice', 'Contract'] : ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
              accessFromChina: false,
              region: 'global',
            });

            console.log(`  ✅ Extracted: ${planName} - $${priceMonthly}/month`);
          }
        }
      }
    }

    if (plans.length === 0) {
      errors.push('No plans could be extracted from Anthropic pricing page. The page structure may have changed.');
    }

  } catch (error) {
    errors.push(`Failed to fetch Anthropic plans: ${error}`);
  }

  return { plans, errors };
}

export async function scrapeAnthropicPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Anthropic Claude subscription plans...');

    const { plans: anthropicPlans, errors: fetchErrors } = await fetchAnthropicPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${anthropicPlans.length} plans from Anthropic`);

    for (const plan of anthropicPlans) {
      try {
        // Validate monthly price (0 is valid for free/enterprise)
        if (plan.priceMonthly < 0) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        plans.push({
          planName: normalizePlanName(plan.name),
          planSlug: slugifyPlan(plan.name),
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          pricingModel: 'subscription',
          tier: plan.tier,
          dailyMessageLimit: plan.dailyMessageLimit,
          features: plan.features,
          region: plan.region,
          accessFromChina: plan.accessFromChina,
          paymentMethods: plan.paymentMethods,
          isOfficial: true,
          currency: 'USD',
        });
      } catch (error) {
        errors.push(`Error processing plan ${plan.name}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Anthropic plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anthropic-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Anthropic plans scrape failed:', error);
    return {
      source: 'Anthropic-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeAnthropicPlans()
    .then(result => {
      console.log('\n📊 Scrape Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .finally(() => closeBrowser());
}