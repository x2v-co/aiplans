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
async function fetchZhipuChinaPlans(): Promise<{ plans: ZhipuChinaPlan[], errors: string[] }> {
  const result = await fetchHTML(ZHIPU_CHINA_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Zhipu China plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: ZhipuChinaPlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const maxPriceMatch = html.match(/Max[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !maxPriceMatch && !teamPriceMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Zhipu China page. The page structure may have changed.']
    };
  }

  // GLM Coding Lite plan - only add if we found the price
  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const litePlan: ZhipuChinaPlan = {
        name: 'GLM Coding Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(litePlan);
    }
  }

  // GLM Coding Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const proPlan: ZhipuChinaPlan = {
        name: 'GLM Coding Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(proPlan);
    }
  }

  // GLM Coding Max plan - only add if we found the price
  if (maxPriceMatch) {
    const priceMatch = maxPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const maxPlan: ZhipuChinaPlan = {
        name: 'GLM Coding Max',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(maxPlan);
    }
  }

  // Team plan - only add if we found the price or explicit mention
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const teamPlan: ZhipuChinaPlan = {
        name: 'GLM Coding Team',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
        accessFromChina: true,
        region: 'china',
      };
      plans.push(teamPlan);
    }
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Zhipu China pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeZhipuPlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Zhipu AI China subscription plans...');

    const { plans: zhipuPlans, errors: fetchErrors } = await fetchZhipuChinaPlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

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
      success: plans.length > 0,
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
