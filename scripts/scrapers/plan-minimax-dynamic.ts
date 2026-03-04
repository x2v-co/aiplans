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
async function fetchMinimaxPlans(): Promise<MinimaxPlan[]> {
  const result = await fetchHTML(MINIMAX_CHINA_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Minimax China plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: MinimaxPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in CNY
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业版/i);

  // Free plan
  const freePlan: MinimaxPlan = {
    name: 'Minimax Free',
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
    region: 'china',
  };
  plans.push(freePlan);

  // Lite plan
  const litePlan: MinimaxPlan = {
    name: 'Minimax Lite',
    priceMonthly: 29,
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
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
  };

  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      litePlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(litePlan);

  // Pro plan
  const proPlan: MinimaxPlan = {
    name: 'Minimax Pro',
    priceMonthly: 99,
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
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
  };

  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      proPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(proPlan);

  // Team plan
  if (teamPriceMatch || html.includes('Team')) {
    const teamPlan: MinimaxPlan = {
      name: 'Minimax Team',
      priceMonthly: 299,
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
      paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
      accessFromChina: true,
      region: 'china',
    };

    if (teamPriceMatch) {
      const priceMatch = teamPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
      if (priceMatch) {
        teamPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
      }
    }
    plans.push(teamPlan);
  }

  // Enterprise plan
  if (enterpriseMatch) {
    const enterprisePlan: MinimaxPlan = {
      name: 'Minimax Enterprise',
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
      region: 'china',
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
function getFallbackPlans(): MinimaxPlan[] {
  return [
    {
      name: 'Minimax Free',
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
      region: 'china',
    },
    {
      name: 'Minimax Lite',
      priceMonthly: 29,
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
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Minimax Pro',
      priceMonthly: 99,
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
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Minimax Team',
      priceMonthly: 299,
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
      paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Minimax Enterprise',
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
      region: 'china',
    },
  ];
}

export async function scrapeMinimaxPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Minimax China subscription plans...');

    const minimaxPlans = await fetchMinimaxPlans();

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
      success: true,
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
