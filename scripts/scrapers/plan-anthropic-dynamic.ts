/**
 * Anthropic Claude Pro Plan Scraper - Dynamic fetching from Claude pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

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

/**
 * Fetch and parse Anthropic subscription plans from their website
 */
async function fetchAnthropicPlans(): Promise<{ plans: AnthropicPlan[], errors: string[] }> {
  const result = await fetchHTML(ANTHROPIC_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Anthropic plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: AnthropicPlan[] = [];

  // Extract prices from HTML - only use actual scraped prices
  const proPriceMatch = html.match(/Claude\s*Pro[^$]*?\$\s*([\d.]+)/i);
  const teamPriceMatch = html.match(/Claude\s*Team[^$]*?\$\s*([\d.]+)/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Check if we found any pricing information - NO HARDCODED FALLBACKS
  if (!proPriceMatch && !teamPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Anthropic page. The page structure may have changed.']
    };
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const proPlan: AnthropicPlan = {
        name: 'Claude Pro',
        priceMonthly: parseFloat(priceMatch[1]),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Credit Card', 'Debit Card', 'Apple Pay', 'Google Pay'],
        accessFromChina: false,
        region: 'global',
      };
      plans.push(proPlan);
    }
  }

  // Team plan - only add if we found the price
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/\$?\s*([\d.]+)/);
    if (priceMatch) {
      const teamPlan: AnthropicPlan = {
        name: 'Claude Team',
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

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: AnthropicPlan = {
      name: 'Claude Enterprise',
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
    errors.push('No plans could be parsed from Anthropic pricing page. The page structure may have changed.');
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
    console.log(`✅ Anthropic plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Anthropic-Plans',
      success: plans.length > 0,
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
  scrapeAnthropicPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
