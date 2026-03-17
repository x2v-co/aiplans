/**
 * Mistral AI Plan Scraper - Dynamic fetching from Mistral pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const MISTRAL_PLANS_URL = 'https://mistral.ai/pricing';

interface MistralPlan {
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
 * Fetch and parse Mistral AI subscription plans from their website
 */
async function fetchMistralPlans(): Promise<{ plans: MistralPlan[], errors: string[] }> {
  const result = await fetchHTML(MISTRAL_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Mistral plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: MistralPlan[] = [];

  // Extract prices from HTML - look for Le Chat pricing patterns
  const proPriceMatch = html.match(/Le Chat\s*Pro[^€$]*?[€$]\s*[\d.]+|Pro[^€$]*?[€$]\s*[\d.]+/i);
  const enterpriseMatch = html.match(/Enterprise|business/i);

  // Check if we found any pricing information
  if (!proPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Mistral page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE/i)) {
    const freePlan: MistralPlan = {
      name: 'Le Chat Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Mistral basic models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: false,
      region: 'global',
    };
    plans.push(freePlan);
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[€$]\s*([\d.]+)/);
    if (priceMatch) {
      const proPlan: MistralPlan = {
        name: 'Le Chat Pro',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Credit Card', 'Debit Card'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(proPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: MistralPlan = {
      name: 'Le Chat Enterprise',
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
    errors.push('No plans could be parsed from Mistral pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeMistralPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Mistral AI subscription plans...');

    const { plans: mistralPlans, errors: fetchErrors } = await fetchMistralPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${mistralPlans.length} plans from Mistral AI`);

    for (const plan of mistralPlans) {
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
          currency: 'EUR',
        });
      } catch (error) {
        errors.push(`Error processing plan ${plan.name}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Mistral AI plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Mistral-Plans',
      success: plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Mistral AI plans scrape failed:', error);
    return {
      source: 'Mistral-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMistralPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
