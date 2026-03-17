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
async function fetchQwenPlans(): Promise<{ plans: QwenPlan[], errors: string[] }> {
  const result = await fetchHTML(QWEN_PRICING_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Qwen pricing page - no HTML returned'] };
  }

  const html = result.data;
  const plans: QwenPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*([\d,.]+)/i) || html.match(/轻量[^￥]*?￥\s*([\d,.]+)/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*([\d,.]+)/i) || html.match(/专业[^￥]*?￥\s*([\d,.]+)/i);
  const enterpriseMatch = html.match(/Enterprise|企业/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !enterpriseMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Qwen page. The page structure may have changed.']
    };
  }

  // Free plan - check if mentioned on page
  if (html.match(/free|Free|FREE|免费/i)) {
    const freePlan: QwenPlan = {
      name: 'Qwen Free Trial',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Free trial tokens', 'Access to Qwen models for testing'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'pay_as_you_go',
    };
    plans.push(freePlan);
  }

  // Lite plan - only add if we found the price
  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,.]+)/);
    if (priceMatch) {
      const litePlan: QwenPlan = {
        name: 'Qwen Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
        accessFromChina: true,
        region: 'both',
        pricingModel: 'subscription',
      };
      plans.push(litePlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,.]+)/);
    if (priceMatch) {
      const proPlan: QwenPlan = {
        name: 'Qwen Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay', 'Credit Card'],
        accessFromChina: true,
        region: 'both',
        pricingModel: 'subscription',
      };
      plans.push(proPlan);
    }
  }

  // Enterprise plan - only add if mentioned (custom pricing)
  if (enterpriseMatch) {
    const enterprisePlan: QwenPlan = {
      name: 'Qwen Enterprise',
      priceMonthly: 0, // Custom pricing
      tier: 'enterprise',
      dailyMessageLimit: undefined,
      features: [],
      paymentMethods: ['Invoice', 'Contract'],
      accessFromChina: true,
      region: 'both',
      pricingModel: 'pay_as_you_go',
    };
    plans.push(enterprisePlan);
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Qwen pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeQwenPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Alibaba Qwen subscription plans...');

    const { plans: qwenPlans, errors: fetchErrors } = await fetchQwenPlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

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
      success: plans.length > 0,
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
