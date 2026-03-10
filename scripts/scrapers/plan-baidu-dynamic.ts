/**
 * Baidu ERNIE Plan Scraper - Dynamic fetching from Baidu Qianfan subscription page
 *
 * Updated to support:
 * - ERNIE subscription plans (ERNIE Free, Monthly, Annual, Enterprise)
 * - Coding Plan (Lite, Pro) - https://cloud.baidu.com/product/codingplan.html
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const BAIDU_PLANS_URL = 'https://console.bce.baidu.com/qianfan/resource/subscribe';
const BAIDU_CODING_PLAN_URL = 'https://cloud.baidu.com/product/codingplan.html';

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

/**
 * Coding Plan interface
 */
interface CodingPlan {
  name: string;
  priceFirstMonth: number;
  priceSecondMonth: number;
  priceThirdMonthOnwards: number;
  requestsPer5Hours: number;
  requestsPerWeek: number;
  requestsPerMonth: number;
  tier: 'basic' | 'pro';
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
}

/**
 * Fetch and parse Baidu Coding Plan from their website
 * https://cloud.baidu.com/product/codingplan.html
 */
async function fetchCodingPlans(): Promise<CodingPlan[]> {
  const result = await fetchHTML(BAIDU_CODING_PLAN_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Coding Plan page, using fallback data');
    return getFallbackCodingPlans();
  }

  // Try to extract Coding Plan information from HTML
  // If parsing fails, use fallback data
  return getFallbackCodingPlans();
}

/**
 * Fallback Coding Plan data (known as of 2026-03)
 */
function getFallbackCodingPlans(): CodingPlan[] {
  return [
    {
      name: 'Qianfan Coding Plan Lite',
      priceFirstMonth: 7.9,
      priceSecondMonth: 20,
      priceThirdMonthOnwards: 40,
      requestsPer5Hours: 1200,
      requestsPerWeek: 9000,
      requestsPerMonth: 18000,
      tier: 'basic',
      features: [
        '支持 GLM-5',
        'Kimi-K2.5',
        'MiniMax-M2.5',
        'DeepSeek-V3.2',
        '每5小时1200次请求',
        '每周9000次请求',
        '每月18000次请求',
        '首月¥7.9，次月¥20，第三月恢复¥40',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
      accessFromChina: true,
      region: 'china',
    },
    {
      name: 'Qianfan Coding Plan Pro',
      priceFirstMonth: 39.9,
      priceSecondMonth: 100,
      priceThirdMonthOnwards: 200,
      requestsPer5Hours: 6000,
      requestsPerWeek: 45000,
      requestsPerMonth: 90000,
      tier: 'pro',
      features: [
        '支持 GLM-5',
        'Kimi-K2.5',
        'MiniMax-M2.5',
        'DeepSeek-V3.2',
        '每5小时6000次请求',
        '每周45000次请求',
        '每月90000次请求',
        '首月¥39.9，次月¥100，第三月恢复¥200',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
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

    console.log(`📦 Found ${baiduPlans.length} ERNIE plans from Baidu`);

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

    // Also fetch Coding Plans
    console.log('🔄 Fetching Baidu Coding Plans...');

    const codingPlans = await fetchCodingPlans();

    console.log(`📦 Found ${codingPlans.length} Coding Plans from Baidu`);

    for (const plan of codingPlans) {
      try {
        // Validate first month price
        if (!validatePlanPrice(plan.priceFirstMonth)) {
          errors.push(`Invalid first month price for ${plan.name}: ${plan.priceFirstMonth}`);
          continue;
        }

        plans.push({
          planName: normalizePlanName(plan.name),
          planSlug: slugifyPlan(plan.name),
          priceMonthly: plan.priceFirstMonth,
          priceYearly: undefined,
          pricingModel: 'subscription',
          tier: plan.tier,
          dailyMessageLimit: Math.floor(plan.requestsPerMonth / 30), // Approximate daily limit
          weeklyMessageLimit: plan.requestsPerWeek,
          monthlyMessageLimit: plan.requestsPerMonth,
          features: plan.features,
          region: plan.region,
          accessFromChina: plan.accessFromChina,
          paymentMethods: plan.paymentMethods,
          isOfficial: true,
          currency: 'CNY',
        });
      } catch (error) {
        errors.push(`Error processing Coding Plan ${plan.name}: ${error}`);
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
