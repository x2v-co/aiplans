/**
 * Google Gemini Advanced Plan Scraper - Dynamic fetching from Gemini subscription page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

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

/**
 * Fetch and parse Google Gemini subscription plans from their website
 */
async function fetchGoogleGeminiPlans(): Promise<{ plans: GoogleGeminiPlan[], errors: string[] }> {
  const result = await fetchHTML(GOOGLE_GEMINI_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Google Gemini plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: GoogleGeminiPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const advancedPriceMatch = html.match(/Gemini\s*Advanced[^$]*?\$\s*([\d.]+)/i) || html.match(/Advanced[^$]*?\$\s*19/i);
  const enterpriseMatch = html.match(/Enterprise|Workspace/i);

  // Check if we found any pricing information
  if (!advancedPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Google Gemini page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE/i)) {
    const freePlan: GoogleGeminiPlan = {
      name: 'Gemini Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Gemini models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    };
    plans.push(freePlan);
  }

  // Advanced plan - only add if we found the price
  if (advancedPriceMatch) {
    const priceMatch = advancedPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const advancedPlan: GoogleGeminiPlan = {
        name: 'Gemini Advanced',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Credit Card', 'Debit Card', 'Google Pay', 'PayPal'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(advancedPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: GoogleGeminiPlan = {
      name: 'Gemini Enterprise',
      priceMonthly: 0, // Custom pricing via Google Workspace
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: false,
      region: 'global',
    };
    plans.push(enterprisePlan);
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Google Gemini pricing page. The page structure may have changed.');
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
        // Validate monthly price
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        // Validate yearly price if present
        if (plan.priceYearly !== null && plan.priceYearly !== undefined && !validatePlanPrice(plan.priceYearly)) {
          errors.push(`Invalid yearly price for ${plan.name}: ${plan.priceYearly}`);
          plan.priceYearly = undefined;
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
      success: plans.length > 0,
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
  scrapeGoogleGeminiPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
