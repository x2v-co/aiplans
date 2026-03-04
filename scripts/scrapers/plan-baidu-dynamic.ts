/**
 * Baidu ERNIE Plan Scraper - Dynamic fetching from Baidu Qianfan subscription page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const BAIDU_PLANS_URL = 'https://console.bce.baidu.com/qianfan/resource/subscribe';

interface BaiduPlan {
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
 * Fetch and parse Baidu ERNIE subscription plans from their website
 */
async function fetchBaiduPlans(): Promise<BaiduPlan[]> {
  const result = await fetchHTML(BAIDU_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Baidu plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: BaiduPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in CNY
  const monthlyPriceMatch = html.match(/Monthly[^￥]*?￥\s*[\d,]+|月度[^￥]*?￥\s*[\d,]+/i);
  const yearlyPriceMatch = html.match(/Annual[^￥]*?￥\s*[\d,]+|年度[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业/i);

  // Free tier
  const freePlan: BaiduPlan = {
    name: 'ERNIE Free',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Access to ERNIE Lite models',
      'Limited API calls',
      'Standard response speed',
      'Web search capabilities',
      'Chinese-optimized',
    ],
    paymentMethods: [],
    accessFromChina: true,
    region: 'china',
  };
  plans.push(freePlan);

  // Monthly subscription
  const monthlyPlan: BaiduPlan = {
    name: 'ERNIE Monthly',
    priceMonthly: 19.90,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Access to ERNIE Pro models',
      'Higher API call limits',
      'Faster response speeds',
      'Extended context windows',
      'Web search capabilities',
      'Chinese-optimized',
      'Image generation capabilities',
      'Basic code generation',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
    accessFromChina: true,
    region: 'china',
  };

  if (monthlyPriceMatch) {
    const priceMatch = monthlyPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      monthlyPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(monthlyPlan);

  // Annual subscription
  const yearlyPlan: BaiduPlan = {
    name: 'ERNIE Annual',
    priceMonthly: 16.58, // ¥199 / 12
    priceYearly: 199,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Everything in Monthly',
      'Access to ERNIE Pro models',
      'Higher API call limits',
      'Faster response speeds',
      'Extended context windows',
      'Web search capabilities',
      'Chinese-optimized',
      'Image generation capabilities',
      'Basic code generation',
      'Annual savings (~17% off monthly)',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
    accessFromChina: true,
    region: 'china',
  };

  if (yearlyPriceMatch) {
    const priceMatch = yearlyPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      yearlyPlan.priceYearly = parseFloat(priceMatch[1].replace(',', ''));
      yearlyPlan.priceMonthly = yearlyPlan.priceYearly / 12;
    }
  }
  plans.push(yearlyPlan);

  // Enterprise plan
  if (enterpriseMatch) {
    const enterprisePlan: BaiduPlan = {
      name: 'ERNIE Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Annual',
        'Access to ERNIE 4.0 models',
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
function getFallbackPlans(): BaiduPlan[] {
  return [
    {
      name: 'ERNIE Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Access to ERNIE Lite models',
        'Limited API calls',
        'Standard response speed',
        'Web search capabilities',
        'Chinese-optimized',
      ],
      paymentMethods: [],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'ERNIE Monthly',
      priceMonthly: 19.90,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Access to ERNIE Pro models',
        'Higher API call limits',
        'Faster response speeds',
        'Extended context windows',
        'Web search capabilities',
        'Chinese-optimized',
        'Image generation capabilities',
        'Basic code generation',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'ERNIE Annual',
      priceMonthly: 16.58, // ¥199 / 12
      priceYearly: 199,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Monthly',
        'Access to ERNIE Pro models',
        'Higher API call limits',
        'Faster response speeds',
        'Extended context windows',
        'Web search capabilities',
        'Chinese-optimized',
        'Image generation capabilities',
        'Basic code generation',
        'Annual savings (~17% off monthly)',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'ERNIE Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Annual',
        'Access to ERNIE 4.0 models',
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

export async function scrapeBaiduPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Baidu ERNIE subscription plans...');

    const baiduPlans = await fetchBaiduPlans();

    console.log(`📦 Found ${baiduPlans.length} plans from Baidu`);

    for (const plan of baiduPlans) {
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
    console.log(`✅ Baidu plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Baidu-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Baidu plans scrape failed:', error);
    return {
      source: 'Baidu-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeBaiduPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
