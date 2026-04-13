/**
 * Zhipu AI Global (Z.AI) Plan Scraper - Dynamic fetching from Z.AI subscription page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const ZHIPU_GLOBAL_PLANS_URL = 'https://z.ai/subscribe';
const ZHIPU_GLOBAL_INVITE_LINK = 'https://z.ai/subscribe?ic=HFGTURQAPY';

interface ZhipuGlobalPlan {
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
 * Fetch and parse Zhipu AI Global subscription plans from their website
 */
async function fetchZhipuGlobalPlans(): Promise<{ plans: ZhipuGlobalPlan[], errors: string[] }> {
  const result = await fetchHTML(ZHIPU_GLOBAL_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Zhipu Global plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: ZhipuGlobalPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^$]*?\$\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^$]*?\$\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^$]*?\$\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !teamPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Zhipu Global page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE/i)) {
    const freePlan: ZhipuGlobalPlan = {
      name: 'Z.AI Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to GLM models', 'Limited message capacity'],
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
      const litePlan: ZhipuGlobalPlan = {
        name: 'Z.AI Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Credit Card', 'PayPal'],
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
      const proPlan: ZhipuGlobalPlan = {
        name: 'Z.AI Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'PayPal'],
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
      const teamPlan: ZhipuGlobalPlan = {
        name: 'Z.AI Team',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Credit Card', 'PayPal', 'Invoice'],
        accessFromChina: true,
        region: 'global',
      };
      plans.push(teamPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: ZhipuGlobalPlan = {
      name: 'Z.AI Enterprise',
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
    errors.push('No plans could be parsed from Zhipu Global pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeZhipuGlobalPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Zhipu AI Global (Z.AI) subscription plans...');

    const { plans: zhipuGlobalPlans, errors: fetchErrors } = await fetchZhipuGlobalPlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

    console.log(`📦 Found ${zhipuGlobalPlans.length} plans from Zhipu AI Global`);
    console.log(`🔗 Invite Link: ${ZHIPU_GLOBAL_INVITE_LINK}`);

    for (const plan of zhipuGlobalPlans) {
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
    console.log(`✅ Zhipu AI Global plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'ZhipuGlobal-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Zhipu AI Global plans scrape failed:', error);
    return {
      source: 'ZhipuGlobal-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeZhipuGlobalPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
