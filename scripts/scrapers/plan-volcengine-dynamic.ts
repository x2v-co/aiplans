/**
 * Volcengine (字节跳动/Seed) Plan Scraper - Dynamic fetching from Volcengine pricing page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const VOLCENGINE_PLANS_URL = 'https://www.volcengine.com/docs/82379/1925114';
const VOLCENGINE_INVITE_LINK = 'https://volcengine.com/L/_uDpCXoFKP0/';

interface VolcenginePlan {
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  dailyMessageLimit?: number;
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
  promotionalPrice?: number; // 推广价
}

/**
 * Fetch and parse Volcengine subscription plans from their website
 */
async function fetchVolcenginePlans(): Promise<VolcenginePlan[]> {
  const result = await fetchHTML(VOLCENGINE_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Volcengine plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: VolcenginePlan[] = [];

  // Try to extract plan information from HTML
  // Volcengine (Seed) pricing for coding tools - not API pricing
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);

  // Free trial
  const freePlan: VolcenginePlan = {
    name: 'Seed Free Trial',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to Doubao basic models',
      'Limited message capacity',
      'Standard response speed',
      'Web browsing',
      'Coding assistance',
      'Chinese-optimized',
    ],
    paymentMethods: [],
    accessFromChina: true,
    region: 'both', // Available in both China and global
  };
  plans.push(freePlan);

  // Lite plan (Programming tool only, not for API calls)
  const litePlan: VolcenginePlan = {
    name: 'Seed Lite',
    priceMonthly: 19,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    promotionalPrice: 9.90, // 推广价
    features: [
      'Access to Doubao Pro models',
      'Programming tool access only',
      'NOT available for API calls',
      'Higher message limits',
      'Faster response speeds',
      'Code generation and debugging',
      'Chinese-optimized',
      'Web browsing',
      'Promotional price: ¥9.90 first month',
      'New user offer: ¥8.90 first month',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'both',
  };

  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      litePlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(litePlan);

  // Pro plan
  const proPlan: VolcenginePlan = {
    name: 'Seed Pro',
    priceMonthly: 59,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    promotionalPrice: 29.90, // 推广价
    features: [
      'Everything in Lite',
      'Access to Doubao Pro+ models',
      'Programming tool access only',
      'NOT available for API calls',
      'Higher message limits',
      'Priority access during peak times',
      'Extended context windows',
      'Advanced code generation',
      'Chinese-optimized',
      'Image analysis',
      'Early access to new features',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'both',
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
    const teamPlan: VolcenginePlan = {
      name: 'Seed Team',
      priceMonthly: 199,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Team collaboration tools',
        'Admin console',
        'Higher data security',
        'Team workspace',
        'Programming tool access only',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'Custom integrations',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
      accessFromChina: true,
      region: 'both',
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
  const enterprisePlan: VolcenginePlan = {
    name: 'Seed Enterprise',
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
    region: 'both',
  };
  plans.push(enterprisePlan);

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
function getFallbackPlans(): VolcenginePlan[] {
  return [
    {
      name: 'Seed Free Trial',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to Doubao basic models',
        'Limited message capacity',
        'Standard response speed',
        'Web browsing',
        'Coding assistance',
        'Chinese-optimized',
      ],
      paymentMethods: [],
      accessFromChina: true,
      region: 'both',
    },
    {
      name: 'Seed Lite',
      priceMonthly: 19,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      promotionalPrice: 9.90,
      features: [
        'Access to Doubao Pro models',
        'Programming tool access only',
        'NOT available for API calls',
        'Higher message limits',
        'Faster response speeds',
        'Code generation and debugging',
        'Chinese-optimized',
        'Web browsing',
        'Promotional price: ¥9.90 first month',
        'New user offer: ¥8.90 first month',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'both',
    },
    {
      name: 'Seed Pro',
      priceMonthly: 59,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      promotionalPrice: 29.90,
      features: [
        'Everything in Lite',
        'Access to Doubao Pro+ models',
        'Programming tool access only',
        'NOT available for API calls',
        'Higher message limits',
        'Priority access during peak times',
        'Extended context windows',
        'Advanced code generation',
        'Chinese-optimized',
        'Image analysis',
        'Early access to new features',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'both',
    },
    {
      name: 'Seed Team',
      priceMonthly: 199,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Pro',
        'Team collaboration tools',
        'Admin console',
        'Higher data security',
        'Team workspace',
        'Programming tool access only',
        'Extended context windows',
        'Higher rate limits',
        'Priority support',
        'Custom integrations',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
      accessFromChina: true,
      region: 'both',
    },
    {
      name: 'Seed Enterprise',
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
      region: 'both',
    },
  ];
}

export async function scrapeVolcenginePlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Volcengine (字节跳动/Seed) subscription plans...');

    const volcenginePlans = await fetchVolcenginePlans();

    console.log(`📦 Found ${volcenginePlans.length} plans from Volcengine`);
    console.log(`🔗 Invite Link: ${VOLCENGINE_INVITE_LINK}`);

    for (const plan of volcenginePlans) {
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

        // Add promotional price to features if present
        const featuresWithPromo = [...plan.features];
        if (plan.promotionalPrice) {
          featuresWithPromo.push(`Promotional price: ¥${plan.promotionalPrice}`);
        }

        plans.push({
          planName: normalizePlanName(plan.name),
          planSlug: slugifyPlan(plan.name),
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          pricingModel: 'subscription',
          tier: plan.tier,
          dailyMessageLimit: plan.dailyMessageLimit,
          features: featuresWithPromo,
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
    console.log(`✅ Volcengine plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Volcengine-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Volcengine plans scrape failed:', error);
    return {
      source: 'Volcengine-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeVolcenginePlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
