/**
 * Zhipu AI China (ChatGLM) Plan Scraper - Dynamic fetching from Zhipu coding plan page
 */

import type { ScrapedPlan, PlanScraperResult } from '../utils/plan-validator';
import { validatePlanPrice, slugifyPlan, normalizePlanName } from '../utils/plan-validator';
import { fetchHTML } from './base-fetcher';

const ZHIPU_CHINA_PLANS_URL = 'https://bigmodel.cn/glm-coding';
const ZHIPU_CHINA_INVITE_LINK = 'https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765';

interface ZhipuChinaPlan {
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  dailyMessageLimit?: number;
  features: string[];
  paymentMethods: string[];
  accessFromChina: boolean;
  region: string;
  quarterlyDiscount?: number; // 季度折扣
  yearlyDiscount?: number; // 年度折扣
}

/**
 * Fetch and parse Zhipu AI China subscription plans from their website
 */
async function fetchZhipuChinaPlans(): Promise<ZhipuChinaPlan[]> {
  const result = await fetchHTML(ZHIPU_CHINA_PLANS_URL);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Zhipu China plans page, using fallback data');
    return getFallbackPlans();
  }

  const html = result.data;
  const plans: ZhipuChinaPlan[] = [];

  // Try to extract plan information from HTML
  // Look for pricing patterns in CNY (GLM Coding Lite/Pro/Max)
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const maxPriceMatch = html.match(/Max[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);

  // GLM Coding Lite plan
  const litePlan: ZhipuChinaPlan = {
    name: 'GLM Coding Lite',
    priceMonthly: 44,
    priceYearly: undefined,
    tier: 'basic',
    dailyMessageLimit: undefined,
    features: [
      '3x Claude Pro equivalent usage',
      'Access to GLM-4.7 models',
      'Access to GLM-4.5-Air',
      'Code generation and debugging',
      'Extended context windows',
      'Priority access',
      'Chinese-optimized',
      'Quarterly discount: 10% off',
      'Yearly discount: 30% off',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
    quarterlyDiscount: 0.10, // 9折
    yearlyDiscount: 0.30, // 7折
  };

  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      litePlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(litePlan);

  // GLM Coding Pro plan
  const proPlan: ZhipuChinaPlan = {
    name: 'GLM Coding Pro',
    priceMonthly: 134,
    priceYearly: undefined,
    tier: 'pro',
    dailyMessageLimit: undefined,
    features: [
      '5x GLM Coding Lite usage',
      'Access to GLM-4.7 models',
      'Access to GLM-4.5-Air',
      'Higher message limits',
      'Priority access during peak times',
      'Extended context windows',
      'Advanced code generation',
      'Chinese-optimized',
      'Quarterly discount: 10% off',
      'Yearly discount: 30% off',
      'Early access to new models',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
    quarterlyDiscount: 0.10,
    yearlyDiscount: 0.30,
  };

  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      proPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(proPlan);

  // GLM Coding Max plan
  const maxPlan: ZhipuChinaPlan = {
    name: 'GLM Coding Max',
    priceMonthly: 422,
    priceYearly: undefined,
    tier: 'team',
    dailyMessageLimit: undefined,
    features: [
      '4x GLM Coding Pro usage',
      'Access to GLM-5 models',
      'Access to GLM-4.7 models',
      'Access to GLM-4.5-Air',
      'Highest message limits',
      'Priority access during peak times',
      'Extended context windows',
      'Advanced code generation and debugging',
      'Chinese-optimized',
      'Quarterly discount: 10% off',
      'Yearly discount: 30% off',
      'Early access to new models',
      'Priority support',
    ],
    paymentMethods: ['Alipay', 'WeChat Pay'],
    accessFromChina: true,
    region: 'china',
    quarterlyDiscount: 0.10,
    yearlyDiscount: 0.30,
  };

  if (maxPriceMatch) {
    const priceMatch = maxPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      maxPlan.priceMonthly = parseFloat(priceMatch[1].replace(',', ''));
    }
  }
  plans.push(maxPlan);

  // Team plan (if available)
  if (teamPriceMatch || html.includes('Team') || html.includes('企业')) {
    const teamPlan: ZhipuChinaPlan = {
      name: 'GLM Coding Team',
      priceMonthly: 0, // Custom pricing
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        'Everything in Max',
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
    plans.push(teamPlan);
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
function getFallbackPlans(): ZhipuChinaPlan[] {
  return [
    {
      name: 'GLM Coding Lite',
      priceMonthly: 44,
      priceYearly: undefined,
      tier: 'basic',
      dailyMessageLimit: undefined,
      features: [
        '3x Claude Pro equivalent usage',
        'Access to GLM-4.7 models',
        'Access to GLM-4.5-Air',
        'Code generation and debugging',
        'Extended context windows',
        'Priority access',
        'Chinese-optimized',
        'Quarterly discount: 10% off',
        'Yearly discount: 30% off',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
      quarterlyDiscount: 0.10,
      yearlyDiscount: 0.30,
    },
    {
      name: 'GLM Coding Pro',
      priceMonthly: 134,
      priceYearly: undefined,
      tier: 'pro',
      dailyMessageLimit: undefined,
      features: [
        '5x GLM Coding Lite usage',
        'Access to GLM-4.7 models',
        'Access to GLM-4.5-Air',
        'Higher message limits',
        'Priority access during peak times',
        'Extended context windows',
        'Advanced code generation',
        'Chinese-optimized',
        'Quarterly discount: 10% off',
        'Yearly discount: 30% off',
        'Early access to new models',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
      quarterlyDiscount: 0.10,
      yearlyDiscount: 0.30,
    },
    {
      name: 'GLM Coding Max',
      priceMonthly: 422,
      priceYearly: undefined,
      tier: 'team',
      dailyMessageLimit: undefined,
      features: [
        '4x GLM Coding Pro usage',
        'Access to GLM-5 models',
        'Access to GLM-4.7 models',
        'Access to GLM-4.5-Air',
        'Highest message limits',
        'Priority access during peak times',
        'Extended context windows',
        'Advanced code generation and debugging',
        'Chinese-optimized',
        'Quarterly discount: 10% off',
        'Yearly discount: 30% off',
        'Early access to new models',
        'Priority support',
      ],
      paymentMethods: ['Alipay', 'WeChat Pay'],
      accessFromChina: true,
      region: 'china',
      quarterlyDiscount: 0.10,
      yearlyDiscount: 0.30,
    },
  ];
}

export async function scrapeZhipuPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Zhipu AI China subscription plans...');

    const zhipuPlans = await fetchZhipuChinaPlans();

    console.log(`📦 Found ${zhipuPlans.length} plans from Zhipu AI China`);
    console.log(`🔗 Invite Link: ${ZHIPU_CHINA_INVITE_LINK}`);

    for (const plan of zhipuPlans) {
      try {
        // Validate monthly price
        if (!validatePlanPrice(plan.priceMonthly)) {
          errors.push(`Invalid monthly price for ${plan.name}: ${plan.priceMonthly}`);
          continue;
        }

        // Calculate yearly price based on discount if not provided
        let yearlyPrice = plan.priceYearly;
        if (!yearlyPrice && plan.yearlyDiscount && plan.priceMonthly > 0) {
          yearlyPrice = plan.priceMonthly * 12 * (1 - plan.yearlyDiscount);
        }

        plans.push({
          planName: normalizePlanName(plan.name),
          planSlug: slugifyPlan(plan.name),
          priceMonthly: plan.priceMonthly,
          priceYearly: yearlyPrice,
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
    console.log(`✅ Zhipu AI China plans scrape completed in ${duration}ms`);
    console.log(`   - Plans processed: ${plans.length}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      source: 'Zhipu-Plans',
      success: true,
      plans,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('❌ Zhipu AI China plans scrape failed:', error);
    return {
      source: 'Zhipu-Plans',
      success: false,
      plans: [],
      errors: [String(error)],
    };
  }
}

// CLI test
if (require.main === module) {
  scrapeZhipuPlans().then(result => {
    console.log('\n📊 Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
  });
}
