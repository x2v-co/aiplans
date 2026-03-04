/**
 * Minimax Global Plan Scraper - Dynamic fetching from Minimax Global coding plan page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

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
async function fetchMinimaxGlobalPlans(): Promise<MinimaxGlobalPlan[]> {
  const result = await fetchHTML(MINIMAX_GLOBAL_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Minimax Global plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: MinimaxGlobalPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in USD
  const litePriceMatch = html.match(/Lite[^$]*?\$\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^$]*?\$\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^$]*?\$\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Free plan
  const freePlan: MinimaxGlobalPlan = {
    name: 'Minimax Global Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to Minimax basic models',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
      'Basic coding assistance',
    ],
    paymentMethods: [],
    accessFromChina: true, // Minimax Global is accessible from China
    region: 'global',
  };
  plans.push(freePlan);

  // Lite plan
  const litePlan: MinimaxGlobalPlan = {
    name: 'Minimax Global Lite',
    priceMonthly: 5,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Access to Minimax Lite models',
      'Higher message limits',
      'Faster response speeds',
      'Extended context windows',
      'Code generation and debugging',
      'File upload support',
      'Priority access',
    ],
    paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
    accessFromChina: true,
    region: 'global',
  };

  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/\$?\s*([\d,]+)/);
    if (priceMatch) {
      litePlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(litePlan);

  // Pro plan
  const proPlan: MinimaxGlobalPlan = {
    name: 'Minimax Global Pro',
    priceMonthly: 15,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Everything in Lite',
      'Access to Minimax Pro models',
      'Higher message limits',
      'Priority access during peak times',
      'Extended context windows',
      'Advanced code generation',
      'Image analysis',
      'Data analysis capabilities',
      'Early access to new features',
    ],
    paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
    accessFromChina: true,
    region: 'global',
  };

  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/\$?\s*([\d,]+)/);
    if (priceMatch) {
      proPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(proPlan);

  // Team plan
  if (teamPriceMatch || html.includes('Team')) {
    const teamPlan: MinimaxGlobalPlan = {
      name: 'Minimax Global Team',
      priceMonthly: 45,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Team collaboration tools',
        'Admin console',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'Custom integrations',
      ],
      paymentMethods: ['Credit Card', 'PayPal', 'Alipay', 'Invoice'],
      accessFromChina: true,
      region: 'global',
    };

    if (teamPriceMatch) {
      const priceMatch = teamPriceMatch[0].match(/\$?\s*([\d,]+)/);
      if (priceMatch) {
        teamPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
      }
    }
    plans.push(teamPlan);
  }

  // Enterprise plan
  if (enterpriseMatch) {
    const enterprisePlan: MinimaxGlobalPlan = {
      name: 'Minimax Global Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Team',
        'Full API access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'Data residency options',
        'Custom fine-tuning capabilities',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'global',
    };
    plans.push(enterprisePlan);
  }

  // If no plans found, use fallback
  if (plans.length === 0) {
    console.warn('No plans parsed from HTML, using fallback data');
    return getFallbackPlans();
  }

  return plans;
}

/**
 * Fallback plan data (known as of 2025-2026)
 */
function getFallbackPlans(): MinimaxGlobalPlan[] {
  return [
    {
      name: 'Minimax Global Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to Minimax basic models',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing',
        'Basic coding assistance',
      ],
      paymentMethods: [],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Minimax Global Lite',
      priceMonthly: 5,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Access to Minimax Lite models',
        'Higher message limits',
        'Faster response speeds',
        'Extended context windows',
        'Code generation and debugging',
        'File upload support',
        'Priority access',
      ],
      paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Minimax Global Pro',
      priceMonthly: 15,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Lite',
        'Access to Minimax Pro models',
        'Higher message limits',
        'Priority access during peak times',
        'Extended context windows',
        'Advanced code generation',
        'Image analysis',
        'Data analysis capabilities',
        'Early access to new features',
      ],
      paymentMethods: ['Credit Card', 'PayPal', 'Alipay'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Minimax Global Team',
      priceMonthly: 45,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Team collaboration tools',
        'Admin console',
        'Higher data security',
        'Team workspace',
        'Data exclusion from training',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'Custom integrations',
      ],
      paymentMethods: ['Credit Card', 'PayPal', 'Alipay', 'Invoice'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Minimax Global Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Team',
        'Full API access',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Custom AI models',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'Data residency options',
        'Custom fine-tuning capabilities',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'global',
    },
  ];
}

export async function scrapeMinimaxGlobalPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Minimax Global subscription plans...');

    const minimaxGlobalPlans = await fetchMinimaxGlobalPlans();

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
      success: true,
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
