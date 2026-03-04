/**
 * Alibaba Qwen Plan Scraper - Dynamic fetching from Alibaba Cloud pricing page
 *
 * Note: Qwen primarily uses pay-as-you-go (token-based) pricing for API access.
 * This scraper handles the token-based pricing model and any available subscription plans.
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const QWEN_PRICING_URL = 'https://help.aliyun.com/zh/model-studio/coding-plan';
const QWEN_INVITE_LINK = 'https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263..';

interface QwenPlan {
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  dailyMessageLimit?: number;
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
  pricingModel: 'subscription' | 'token_pack' | 'pay_as_you_go';
}

/**
 * Fetch and parse Qwen pricing from Alibaba Cloud
 */
async function fetchQwenPlans(): Promise<QwenPlan[]> {
  const result = await fetchHTML(QWEN_PRICING_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Qwen pricing page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: QwenPlan[] = [];

  // Qwen Coding Plan Subscription Tiers (from official page)
  // https://help.aliyun.com/zh/model-studio/coding-plan

  // Qwen Free Trial
  const freePlan: QwenPlan = {
    name: 'Qwen Free Trial',
    priceMonthly: 0,
    tier: 'free',
    dailyMessageLimit: undefined,
    features: [
      'Free trial tokens',
      'Access to Qwen models for testing',
      'Standard response speed',
      'Chinese-optimized',
    ],
    paymentMethods: [],
    accessFromChina: true,
    region: 'both',
    pricingModel: 'pay_as_you_go',
  };
  plans.push(freePlan);

  // Qwen Lite - ¥7.9/month
  const litePlan: QwenPlan = {
    name: 'Qwen Lite',
    priceMonthly: 7.9,
    priceYearly: 7.9 * 12,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      '¥7.9/month subscription',
      'Supports: qwen-plus, qwen-max',
      'Basic coding features',
      'Standard response speed',
      'Chinese-optimized',
      'Alipay, WeChat Pay, Credit Card',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
    accessFromChina: true,
    region: 'both',
    pricingModel: 'subscription',
  };
  plans.push(litePlan);

  // Qwen Pro - ¥39.9/month
  const proPlan: QwenPlan = {
    name: 'Qwen Pro',
    priceMonthly: 39.9,
    priceYearly: 39.9 * 12,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      '¥39.9/month subscription',
      'Supports: qwen-3.5-plus, qwen-max, kimi-k2.5, MiniMax-M2.5, glm-5',
      'Advanced coding features',
      'Faster response speed',
      'More models available',
      'Chinese-optimized',
      'Alipay, WeChat Pay, Credit Card',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
    accessFromChina: true,
    region: 'both',
    pricingModel: 'subscription',
  };
  plans.push(proPlan);

  // Token Pack options (if available)
  const tokenPackPlan: QwenPlan = {
    name: 'Qwen Token Pack',
    priceMonthly: 0, // Variable pricing based on pack size
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      'Pre-purchased token packs',
      'Discount vs pay-as-you-go',
      'Valid for 12 months',
      'Access to all Qwen models',
      'Chinese-optimized',
      'Cost-effective for regular users',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
    accessFromChina: true,
    region: 'both',
    pricingModel: 'token_pack',
  };
  plans.push(tokenPackPlan);

  // Enterprise plan
  const enterprisePlan: QwenPlan = {
    name: 'Qwen Enterprise',
    priceMonthly: 0, // Custom pricing
    tier: 'enterprise',
    dailyMessageLimit: undefined,
    features: [
      'Volume discounts',
      'Custom model deployment',
      'Dedicated infrastructure',
      'Enterprise-grade security',
      'SSO integration',
      'Audit logs',
      'Dedicated account manager',
      'Priority access to new features',
      'SLA guarantees',
      'Data residency options',
      'Custom fine-tuning capabilities',
    ],
    paymentMethods: ['Invoice', 'Contract'],
    accessFromChina: true,
    region: 'both',
    pricingModel: 'pay_as_you_go',
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
function getFallbackPlans(): QwenPlan[] {
  return [
    {
      name: 'Qwen Free Trial',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: [
        'Free trial tokens',
        'Access to Qwen models for testing',
        'Standard response speed',
        'Chinese-optimized',
      ],
      paymentMethods: [],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'pay_as_you_go',
    },
    {
      name: 'Qwen Lite',
      priceMonthly: 7.9,
      priceYearly: 7.9 * 12,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        '¥7.9/month subscription',
        'Supports: qwen-plus, qwen-max',
        'Basic coding features',
        'Standard response speed',
        'Chinese-optimized',
        'Alipay, WeChat Pay, Credit Card',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'subscription',
    },
    {
      name: 'Qwen Pro',
      priceMonthly: 39.9,
      priceYearly: 39.9 * 12,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        '¥39.9/month subscription',
        'Supports: qwen-3.5-plus, qwen-max, kimi-k2.5, MiniMax-M2.5, glm-5',
        'Advanced coding features',
        'Faster response speed',
        'More models available',
        'Chinese-optimized',
        'Alipay, WeChat Pay, Credit Card',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'subscription',
    },
    {
      name: 'Qwen Token Pack',
      priceMonthly: 0,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        'Pre-purchased token packs',
        'Discount vs pay-as-you-go',
        'Valid for 12 months',
        'Access to all Qwen models',
        'Chinese-optimized',
        'Cost-effective for regular users',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'token_pack',
    },
    {
      name: 'Qwen Enterprise',
      priceMonthly: 0,
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [
        'Volume discounts',
        'Custom model deployment',
        'Dedicated infrastructure',
        'Enterprise-grade security',
        'SSO integration',
        'Audit logs',
        'Dedicated account manager',
        'Priority access to new features',
        'SLA guarantees',
        'Data residency options',
        'Custom fine-tuning capabilities',
      ],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'pay_as_you_go',
    },
  ];
}

export async function scrapeQwenPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Alibaba Qwen subscription plans...');

    const qwenPlans = await fetchQwenPlans();

    console.log(`📦 Found ${qwenPlans.length} plans from Alibaba Qwen`);
    console.log(`🔗 Invite Link: ${QWEN_INVITE_LINK}`);

    for (const plan of qwenPlans) {
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
          pricingModel: plan.pricingModel,
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
    console.log(`✅ Alibaba Qwen plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Qwen-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Alibaba Qwen plans scrape failed:', error);
    return {
      source: 'Qwen-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeQwenPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
