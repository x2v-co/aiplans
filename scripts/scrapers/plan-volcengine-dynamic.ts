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
async function fetchVolcenginePlans(): Promise<{ plans: VolcenginePlan[], errors: string[] }> {
  const result = await fetchHTML(VOLCENGINE_PLANS_URL);
  const errors: string[] = [];

  if (!result.success || !result.data) {
    return { plans: [], errors: ['Failed to fetch Volcengine plans page - no HTML returned'] };
  }

  const html = result.data;
  const plans: VolcenginePlan[] = [];

  // Extract prices from HTML - only proceed if we can find actual pricing data
  const litePriceMatch = html.match(/Lite[^￥]*?￥\s*[\d,]+/i);
  const proPriceMatch = html.match(/Pro[^￥]*?￥\s*[\d,]+/i);
  const teamPriceMatch = html.match(/Team[^￥]*?￥\s*[\d,]+/i);

  // Check if we found any pricing information
  if (!litePriceMatch && !proPriceMatch && !teamPriceMatch) {
    return {
      plans: [],
      errors: ['No pricing information found on Volcengine page. The page structure may have changed.']
    };
  }

  // Free trial - check if mentioned on page
  if (html.match(/free|Free|FREE|免费|试用/i)) {
    const freePlan: VolcenginePlan = {
      name: 'Seed Free Trial',
      priceMonthly: 0,
      tier: 'free',
      dailyMessageLimit: undefined,
      features: ['Access to Doubao basic models', 'Limited message capacity'],
      paymentMethods: [],
      accessFromChina: true,
      region: 'both',
    };
    plans.push(freePlan);
  }

  // Lite plan - only add if we found the price
  if (litePriceMatch) {
    const priceMatch = litePriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const litePlan: VolcenginePlan = {
        name: 'Seed Lite',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'basic',
        dailyMessageLimit: undefined,
        features: [], // Features should be extracted from actual page content
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'both',
      };
      plans.push(litePlan);
    }
  }

  // Pro plan - only add if we found the price
  if (proPriceMatch) {
    const priceMatch = proPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const proPlan: VolcenginePlan = {
        name: 'Seed Pro',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'pro',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay'],
        accessFromChina: true,
        region: 'both',
      };
      plans.push(proPlan);
    }
  }

  // Team plan - only add if we found the price
  if (teamPriceMatch) {
    const priceMatch = teamPriceMatch[0].match(/[￥]?\s*([\d,]+)/);
    if (priceMatch) {
      const teamPlan: VolcenginePlan = {
        name: 'Seed Team',
        priceMonthly: parseFloat(priceMatch[1].replace(',', '')),
        priceYearly: undefined,
        tier: 'team',
        dailyMessageLimit: undefined,
        features: [],
        paymentMethods: ['Alipay', 'WeChat Pay', 'Invoice'],
        accessFromChina: true,
        region: 'both',
      };
      plans.push(teamPlan);
    }
  }

  if (plans.length === 0) {
    errors.push('No plans could be parsed from Volcengine pricing page. The page structure may have changed.');
  }

  return { plans, errors };
}

export async function scrapeVolcenginePlans(): Promise<PlanScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const plans: ScrapedPlan[] = [];

  try {
    console.log('🔄 Fetching Volcengine (字节跳动/Seed) subscription plans...');

    const { plans: volcenginePlans, errors: fetchErrors } = await fetchVolcenginePlans();
    if (fetchErrors.length > 0) {
      errors.push(...fetchErrors);
    }

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
      success: plans.length > 0,
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
