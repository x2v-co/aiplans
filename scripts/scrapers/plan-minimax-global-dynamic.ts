/**
 * Minimax Global Plan Scraper - Dynamic fetching from Minimax Global coding plan page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const MINIMAX_GLOBAL_PLANS_URL = 'https://platform.minimax.io/docs/guides/pricing-coding-plan';

interface MinimaxGlobalPlan {
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
 * Fetch and parse Minimax Global subscription plans from their website
 */
async function fetchMinimaxGlobalPlans(): Promise<{ plans: MinimaxGlobalPlan[], errors: string[] }> {
  const result = await fetchHTMLSmart(MINIMAX_GLOBAL_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Minimax Global plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: MinimaxGlobalPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^$]*?\$\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^$]*?\$\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^$]*?\$\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !teamPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Minimax Global page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE/i)) {
    const freePlan: MinimaxGlobalPlan = {
      name: 'Minimax Global Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Minimax basic models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'global',
    };
    plans.push(freePlan);
  }

  // Lite plan - only add if we found the price
  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/\$?\s*([\d,]+)/);
    if (priceMatch) {
      const litePlan: MinimaxGlobalPlan = {
        name: 'Minimax Global Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
        accessFromChina: true,
        region: 'global',
      };
      plans.push(litePlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/\$?\s*([\d,]+)/);
    if (priceMatch) {
      const proPlan: MinimaxGlobalPlan = {
        name: 'Minimax Global Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
        accessFromChina: true,
        region: 'global',
      };
      plans.push(proPlan);
    }
  }

  // Team plan - only add if we found the price
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/\$?\s*([\d,]+)/);
    if (priceMatch) {
      const teamPlan: MinimaxGlobalPlan = {
        name: 'Minimax Global Team',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'PayPal', 'Alipay', 'Invoice'],
        accessFromChina: true,
        region: 'global',
      };
      plans.push(teamPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: MinimaxGlobalPlan = {
      name: 'Minimax Global Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'global',
    };
    plans.push(enterprisePlan);
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Minimax Global pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeMinimaxGlobalPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Minimax Global subscription plans...');

    const { plans: minimaxGlobalPlans, errors: fetchErrors } = await fetchMinimaxGlobalPlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

    console.log(`📦 Found ${minimaxGlobalPlans.length} plans from Minimax Global`);

    for (const plan of minimaxGlobalPlans) {
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
    console.log(`✅ Minimax Global plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'MinimaxGlobal-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Minimax Global plans scrape failed:', error);
    return {
      source: 'MinimaxGlobal-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMinimaxGlobalPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
