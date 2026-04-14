/**
 * Moonshot (Kimi) Plan Scraper - Dynamic fetching from Moonshot pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTMLSmart } from './base-fetcher';

const MOONSHOT_PLANS_URL = 'https://platform.moonshot.cn/pricing/chat';

interface MoonshotPlan {
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
 * Fetch and parse Moonshot subscription plans from their website
 */
async function fetchMoonshotPlans(): Promise<{ plans: MoonshotPlan[], errors: string[] }> {
  const result = await fetchHTMLSmart(MOONSHOT_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Moonshot plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: MoonshotPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const basicPriceMatch = html.match(/Basic[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业/i);

  // Check if we found any pricing information
  if (!basicPriceMatch && !proPriceMatch && !teamPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Moonshot page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE|免费/i)) {
    const freePlan: MoonshotPlan = {
      name: 'Kimi Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Moonshot basic models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'china',
    };
    plans.push(freePlan);
  }

  // Basic plan - only add if we found the price
  if (basicPriceMatch) {
    const priceMatch = basicPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const basicPlan: MoonshotPlan = {
        name: 'Kimi Basic',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(basicPlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const proPlan: MoonshotPlan = {
        name: 'Kimi Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(proPlan);
    }
  }

  // Team plan - only add if we found the price
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const teamPlan: MoonshotPlan = {
        name: 'Kimi Team',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(teamPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: MoonshotPlan = {
      name: 'Kimi Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'china',
    };
    plans.push(enterprisePlan);
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Moonshot pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeMoonshotPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Moonshot (Kimi) subscription plans...');

    const { plans: moonshotPlans, errors: fetchErrors } = await fetchMoonshotPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${moonshotPlans.length} plans from Moonshot`);

    for (const plan of moonshotPlans) {
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
          currency: 'CNY',
        });
      } catch (error) {
        errors.push(`Error processing plan ${plan.name}: ${error}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Moonshot plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Moonshot-Plans',
      success: errors.length === 0 && plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Moonshot plans scrape failed:', error);
    return {
      source: 'Moonshot-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMoonshotPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
