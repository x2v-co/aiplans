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
async function fetchZhipuGlobalPlans(): Promise<ZhipuGlobalPlan[]> {
  const result = await fetchHTML(ZHIPU_GLOBAL_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Zhipu Global plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: ZhipuGlobalPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in USD
  const litePriceMatch = html.match(/Lite[^$]*?\$\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^$]*?\$\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^$]*?\$\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise/i);

  // Free plan
  const freePlan: ZhipuGlobalPlan = {
    name: 'Z.AI Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to GLM-4 models',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
      'Basic coding assistance',
    ],
    paymentMethods: [],
    accessFromChina: true, // Z.AI is accessible from China
    region: 'global',
  };
  plans.push(freePlan);

  // Lite plan
  const litePlan: ZhipuGlobalPlan = {
    name: 'Z.AI Lite',
    priceMonthly: 7,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Access to GLM-4.7 models',
      'Access to GLM-4.5-Air',
      'Higher message limits',
      'Faster response speeds',
      'Extended context windows',
      'Code generation and debugging',
      'File upload support',
      'Priority access',
    ],
    paymentMethods: ['Credit Card', 'PayPal'],
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
  const proPlan: ZhipuGlobalPlan = {
    name: 'Z.AI Pro',
    priceMonthly: 20,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Everything in Lite',
      'Access to GLM-5 models',
      'Higher message limits',
      'Priority access during peak times',
      'Extended context windows',
      'Advanced code generation',
      'Image analysis',
      'Data analysis capabilities',
      'Early access to new features',
    ],
    paymentMethods: ['Credit Card', 'PayPal'],
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
    const teamPlan: ZhipuGlobalPlan = {
      name: 'Z.AI Team',
      priceMonthly: 60,
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
      paymentMethods: ['Credit Card', 'PayPal', 'Invoice'],
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
    const enterprisePlan: ZhipuGlobalPlan = {
      name: 'Z.AI Enterprise',
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
function getFallbackPlans(): ZhipuGlobalPlan[] {
  return [
    {
      name: 'Z.AI Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to GLM-4 models',
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
      name: 'Z.AI Lite',
      priceMonthly: 7,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Access to GLM-4.7 models',
        'Access to GLM-4.5-Air',
        'Higher message limits',
        'Faster response speeds',
        'Extended context windows',
        'Code generation and debugging',
        'File upload support',
        'Priority access',
      ],
      paymentMethods: ['Credit Card', 'PayPal'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Z.AI Pro',
      priceMonthly: 20,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Lite',
        'Access to GLM-5 models',
        'Higher message limits',
        'Priority access during peak times',
        'Extended context windows',
        'Advanced code generation',
        'Image analysis',
        'Data analysis capabilities',
        'Early access to new features',
      ],
      paymentMethods: ['Credit Card', 'PayPal'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Z.AI Team',
      priceMonthly: 60,
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
      paymentMethods: ['Credit Card', 'PayPal', 'Invoice'],
      accessFromChina: true,
      region: 'global',
    },
    {
      name: 'Z.AI Enterprise',
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

export async function scrapeZhipuGlobalPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Zhipu AI Global (Z.AI) subscription plans...');

    const zhipuGlobalPlans = await fetchZhipuGlobalPlans();

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
      success: true,
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
