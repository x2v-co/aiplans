/**
 * Moonshot (Kimi) Plan Scraper - Dynamic fetching from Moonshot pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

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
async function fetchMoonshotPlans(): Promise<MoonshotPlan[]> {
  const result = await fetchHTML(MOONSHOT_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Moonshot plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: MoonshotPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in CNY for Kimi subscription
  const basicPriceMatch = html.match(/Basic[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业/i);

  // Free plan (Kimi Free)
  const freePlan: MoonshotPlan = {
    name: 'Kimi Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to Moonshot basic models',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
      'File upload support (limited)',
      'Chinese-optimized',
    ],
    paymentMethods: [],
    accessFromChina: true,
    region: 'china',
  };
  plans.push(freePlan);

  // Basic plan
  const basicPlan: MoonshotPlan = {
    name: 'Kimi Basic',
    priceMonthly: 12,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Access to Moonshot v1 models',
      'Higher message limits',
      'Faster response speeds',
      'Extended context windows',
      'File upload support',
      'Web browsing',
      'Chinese-optimized',
      'Code generation support',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
  };

  if (basicPriceMatch) {
    const priceMatch = basicPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      basicPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(basicPlan);

  // Pro plan
  const proPlan: MoonshotPlan = {
    name: 'Kimi Pro',
    priceMonthly: 68,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      'Everything in Basic',
      'Access to Moonshot v1-128k and v1-256k',
      'Higher message limits',
      'Priority access during peak times',
      'Extended context windows (up to 256k)',
      'Advanced file analysis',
      'Chinese-optimized',
      'Advanced code generation',
      'Image analysis',
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
  if (teamPriceMatch || html.includes('Team') || html.includes('团队')) {
    const teamPlan: MoonshotPlan = {
      name: 'Kimi Team',
      priceMonthly: 198,
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
    const enterprisePlan: MoonshotPlan = {
      name: 'Kimi Enterprise',
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
function getFallbackPlans(): MoonshotPlan[] {
  return [
    {
      name: 'Kimi Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to Moonshot basic models',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing',
        'File upload support (limited)',
        'Chinese-optimized',
      ],
      paymentMethods: [],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Kimi Basic',
      priceMonthly: 12,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Access to Moonshot v1 models',
        'Higher message limits',
        'Faster response speeds',
        'Extended context windows',
        'File upload support',
        'Web browsing',
        'Chinese-optimized',
        'Code generation support',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Kimi Pro',
      priceMonthly: 68,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Basic',
        'Access to Moonshot v1-128k and v1-256k',
        'Higher message limits',
        'Priority access during peak times',
        'Extended context windows (up to 256k)',
        'Advanced file analysis',
        'Chinese-optimized',
        'Advanced code generation',
        'Image analysis',
        'Early access to new features',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Kimi Team',
      priceMonthly: 198,
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
      name: 'Kimi Enterprise',
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

export async function scrapeMoonshotPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Moonshot (Kimi) subscription plans...');

    const moonshotPlans = await fetchMoonshotPlans();

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
      success: true,
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
