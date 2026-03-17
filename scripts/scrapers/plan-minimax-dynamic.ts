/**
 * Minimax China Plan Scraper - Dynamic fetching from Minimax coding plan page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const MINIMAX_CHINA_PLANS_URL = 'https://platform.minimaxi.com/docs/guides/pricing-coding-plan';
const MINIMAX_CHINA_INVITE_LINK = 'https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link';

interface MinimaxPlan {
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
 * Fetch and parse Minimax China subscription plans from their website
 */
async function fetchMinimaxPlans(): Promise<{ plans: MinimaxPlan[], errors: string[] }> {
  const result = await fetchHTML(MINIMAX_CHINA_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Minimax China plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: MinimaxPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业版/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !teamPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Minimax China page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE|免费/i)) {
    const freePlan: MinimaxPlan = {
      name: 'Minimax Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Minimax basic models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'china',
    };
    plans.push(freePlan);
  }

  // Lite plan - only add if we found the price
  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const litePlan: MinimaxPlan = {
        name: 'Minimax Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(litePlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const proPlan: MinimaxPlan = {
        name: 'Minimax Pro',
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
      const teamPlan: MinimaxPlan = {
        name: 'Minimax Team',
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
    const enterprisePlan: MinimaxPlan = {
      name: 'Minimax Enterprise',
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
    errors.push('No plans could be parsed from Minimax China pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeMinimaxPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Minimax China subscription plans...');

    const { plans: minimaxPlans, errors: fetchErrors } = await fetchMinimaxPlans();
    errors.push(...fetchErrors);

    console.log(`📦 Found ${minimaxPlans.length} plans from Minimax China`);
    console.log(`🔗 Invite Link: ${MINIMAX_CHINA_INVITE_LINK}`);

    for (const plan of minimaxPlans) {
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
    console.log(`✅ Minimax China plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Minimax-Plans',
      success: plans.length > 0,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Minimax China plans scrape failed:', error);
    return {
      source: 'Minimax-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeMinimaxPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
