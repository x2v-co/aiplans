/**
 * Google Gemini Plan Scraper - Dynamic fetching from Gemini subscription page
 * Uses Playwright for JavaScript-rendered content
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { chromium, Browser } from 'playwright';

const GOOGLE_GEMINI_PLANS_URL = 'https://gemini.google/subscriptions';

interface GoogleGeminiPlan {
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
 * Parse price from various formats (USD, JPY, etc.)
 */
function parsePrice(text: string): { amount: number; currency: string } | null {
  // USD format: $20 or $19.99
  const usdMatch = text.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (usdMatch) {
    return { amount: parseFloat(usdMatch[1]), currency: 'USD' };
  }

  // JPY format: ¥1,200 or ￥1,200 JPY
  const jpyMatch = text.match(/[￥¥]\s*([\d,]+)/);
  if (jpyMatch) {
    return { amount: parseFloat(jpyMatch[1].replace(/,/g, '')), currency: 'JPY' };
  }

  return null;
}

/**
 * Fetch and parse Google Gemini subscription plans using Playwright
 */
async function fetchGoogleGeminiPlans(): Promise<{ plans: GoogleGeminiPlan[], errors: string[] }> {
  const errors: string[] = [];
  const plans: GoogleGeminiPlan[] = [];

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set locale to English to get consistent pricing
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    console.log('📄 Navigating to Google Gemini subscriptions page...');
    await page.goto(GOOGLE_GEMINI_PLANS_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get body text for parsing
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('📄 Body text preview:', bodyText.substring(0, 1000));

    await page.close();

    // Parse from body text
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const searchArea = lines.slice(i, i + 5).join(' ');

      // Look for Gemini Advanced / Google AI Plus (different names in different locales)
      if (/Gemini\s*Advanced|Google\s*AI\s*Plus|AI\s*Plus/i.test(line) || /Advanced/i.test(line) && /gemini|google/i.test(searchArea)) {
        // Look for price in nearby lines
        const priceInfo = parsePrice(searchArea);

        if (priceInfo) {
          const price = priceInfo.amount;

          // Convert JPY to USD if needed (approximate rate)
          const priceUSD = priceInfo.currency === 'JPY' ? Math.round(price / 150) : price;

          // Check if this plan already exists
          if (!plans.find(p => p.name === 'Gemini Advanced')) {
            plans.push({
              name: 'Gemini Advanced',
              priceMonthly: priceUSD,
              tier: 'pro',
              dailyMessageLimit: undefined,
              features: [],
              paymentMethods: ['Credit Card', 'Debit Card', 'Google Pay', 'PayPal'],
              accessFromChina: false,
              region: 'global',
            });
            console.log(`  ✅ Extracted: Gemini Advanced - $${priceUSD}/month (from ${priceInfo.currency} ${price})`);
          }
        }
      }

      // Look for Free plan (English: "Free", Japanese: "無料")
      if (/^(Free|無料)$/i.test(line) || /free\s*(plan|tier)/i.test(line)) {
        const searchAreaLower = searchArea.toLowerCase();
        if ((searchAreaLower.includes('gemini') || searchAreaLower.includes('google ai')) && !plans.find(p => p.name === 'Gemini Free')) {
          plans.push({
            name: 'Gemini Free',
            priceMonthly: 0,
            tier: 'free',
            dailyMessageLimit: undefined,
            features: [],
            paymentMethods: [],
            accessFromChina: false,
            region: 'global',
          });
          console.log(`  ✅ Extracted: Gemini Free - $0/month`);
        }
      }

      // Look for Enterprise/Workspace
      if (/Enterprise|Google\s*Workspace/i.test(line)) {
        if (!plans.find(p => p.name === 'Gemini Enterprise')) {
          plans.push({
            name: 'Gemini Enterprise',
            priceMonthly: 0, // Custom pricing
            tier: 'enterprise',
            dailyMessageLimit: undefined,
            features: [],
            paymentMethods: ['Invoice', 'Contract'],
            accessFromChina: false,
            region: 'global',
          });
          console.log(`  ✅ Extracted: Gemini Enterprise (custom pricing)`);
        }
      }
    }

    if (plans.length === 0) {
      errors.push('No plans could be extracted from Google Gemini page. The page structure may have changed.');
    }

  } catch (error) {
    errors.push(`Failed to fetch Google Gemini plans: ${error}`);
  }

  return { plans, errors };
}

export async function scrapeGoogleGeminiPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Google Gemini subscription plans...');

    const { plans: googleGeminiPlans, errors: fetchErrors } = await fetchGoogleGeminiPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${googleGeminiPlans.length} plans from Google Gemini`);

    for (const plan of googleGeminiPlans) {
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
    console.log(`✅ Google Gemini plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'GoogleGemini-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Google Gemini plans scrape failed:', error);
    return {
      source: 'GoogleGemini-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeGoogleGeminiPlans()
    .then(result => {
      console.log('\n📊 Scrape Result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .finally(() => closeBrowser());
}