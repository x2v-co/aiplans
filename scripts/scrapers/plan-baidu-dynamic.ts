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
async function fetchBaiduPlans(): Promise<{ plans: BaiduPlan[], errors: string[] }> {
  const result = await fetchHTML(BAIDU_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Baidu plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: BaiduPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const monthlyPriceMatch = html.match(/Monthly[^￥]*?￥\s*[\d,]+|月度[^￥]*?￥\s*[\d,]+/i);
  const yearlyPriceMatch = html.match(/Annual[^￥]*?￥\s*[\d,]+|年度[^￥]*?￥\s*[\d,]+/i);
  const enterpriseMatch = html.match(/Enterprise|企业/i);

  // Check if we found any pricing information
  if (!monthlyPriceMatch && !yearlyPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Baidu page. The page structure may have changed.']
    };
  }

  // Free tier - check if mentioned on page
  if (html.match(/free|Free|FREE|免费/i)) {
    const freePlan: BaiduPlan = {
      name: 'ERNIE Free',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to ERNIE Lite models', 'Limited API calls'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'china',
    };
    plans.push(freePlan);
  }

  // Monthly subscription - only add if we found the price
  if (monthlyPriceMatch) {
    const priceMatch = monthlyPriceMatch[0].match(/[￥]?\s*([\d,.]+)/);
    if (priceMatch) {
      const monthlyPlan: BaiduPlan = {
        name: 'ERNIE Monthly',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(monthlyPlan);
    }
  }

  // Annual subscription - only add if we found the price
  if (yearlyPriceMatch) {
    const priceMatch = yearlyPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const yearlyPrice = parseFloat(priceMatch[1].replace(',', ''));
      const yearlyPlan: BaiduPlan = {
        name: 'ERNIE Annual',
        priceMonthly: yearlyPrice / 12,
        priceYearly: yearlyPrice,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay', 'Baidu Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(yearlyPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: BaiduPlan = {
      name: 'ERNIE Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'china',
    };
    plans.push(enterprisePlan);
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Baidu pricing page. The page structure may have changed.');
  }

  return { plans, errors };
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
async function fetchCodingPlans(): Promise<{ plans: CodingPlan[], errors: string[] }> {
  const result = await fetchHTML(BAIDU_CODING_PLAN_URL);

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Baidu Coding Plan page'] };
  }

  const html = result.data;
  const plans: CodingPlan[] = [];
  const errors: string[] = [];

  // Try to extract Coding Plan information from HTML
  // Look for pricing patterns
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,.]+|轻量[^￥]*?￥\s*[\d,.]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,.]+|专业[^￥]*?￥\s*[\d,.]+/i);

  // Note: Actual parsing would require more sophisticated HTML parsing
  // If no plans found, return empty with error
  if (plans.length === 0) {
    errors.push('No Coding Plans could be parsed from Baidu Coding Plan page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeBaiduPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Baidu ERNIE subscription plans...');

    const { plans: baiduPlans, errors: fetchErrors } = await fetchBaiduPlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

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

    const { plans: codingPlans, errors: codingErrors } = await fetchCodingPlans();
    if (codingErrors.length > 0) {
      errors.push(...codingErrors);
    }

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
      success: plans.length > 0,
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
