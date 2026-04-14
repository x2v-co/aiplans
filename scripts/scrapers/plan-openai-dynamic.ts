/**
 * OpenAI Plan Scraper - Dynamic fetching from ChatGPT pricing page
 * NO FALLBACK DATA - Fails cleanly when scraping fails
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const OPENAI_PLANS_URL = 'https://openai.com/chatgpt/pricing/';

interface OpenAIPlan {
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
 * Fetch and parse OpenAI subscription plans from their website
 */
async function fetchOpenAIPlans(): Promise<{ plans: OpenAIPlan[], errors: string[] }> {
  const result = await fetchHTMLSmart(OPENAI_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch OpenAI plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: OpenAIPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  // Look for plan names like "Free", "Plus", "Team", "Enterprise", "Pro"
  const freeMatch = html.match(/Free/i);
  const plusPriceMatch = html.match(/Plus[^$]*?\$\s*20|ChatGPT\s*Plus[^$]*?\$\s*20/i);
  const teamPriceMatch = html.match(/Team[^$]*?\$\s*25|ChatGPT\s*Team[^$]*?\$\s*25/i);
  const proPriceMatch = html.match(/ChatGPT\s*Pro[^$]*?\$\s*200/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Check if we found any pricing information
  if (!freeMatch && !plusPriceMatch && !teamPriceMatch && !proPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on OpenAI page. The page structure may have changed.']
    };
  }

  // Free plan - only add if mentioned
  if (freeMatch) {
    const freePlan: OpenAIPlan = {
      name: 'ChatGPT Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [], // Features should be extracted from actual page content
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    };
    plans.push(freePlan);
  }

  // Plus plan - only add if we found the price
  if (plusPriceMatch) {
    const priceMatch = plusPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const plusPlan: OpenAIPlan = {
        name: 'ChatGPT Plus',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(plusPlan);
    }
  }

  // Team plan - only add if we found the price
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const teamPlan: OpenAIPlan = {
        name: 'ChatGPT Team',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'Invoice'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(teamPlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const proPlan: OpenAIPlan = {
        name: 'ChatGPT Pro',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(proPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: OpenAIPlan = {
      name: 'ChatGPT Enterprise',
      priceMonthly: 0, // Custom pricing
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
    errors.push('No plans could be parsed from OpenAI pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeOpenAIPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching OpenAI subscription plans...');

    const { plans: openaiPlans, errors: fetchErrors } = await fetchOpenAIPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${openaiPlans.length} plans from OpenAI`);

    for (const plan of openaiPlans) {
      try {
        // Validate monthly price
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        // Validate yearly price if present (only check if it's a number)
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
    console.log(`✅ OpenAI plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'OpenAI-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ OpenAI plans scrape failed:', error);
    return {
      source: 'OpenAI-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeOpenAIPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
