/**
 * Data-driven FAQ for the per-model plan comparison page.
 *
 * Used twice so the visible answers and the FAQPage JSON-LD never drift:
 *  - serialized as FAQPage JSON-LD by page.tsx
 *  - rendered visibly in compare-plans-view.tsx (passed in as a prop)
 *
 * Answers are derived from the actual PlanComparison payload — the cheapest
 * plan, whether a free tier exists, the *real* max annual discount the page
 * already computed, and China reachability — rather than a fixed "15-20%"
 * boilerplate that may be wrong for the model in question.
 */
import { formatPrice, type CurrencyCode } from '@/lib/currency';
import type { Locale } from '@/lib/seo';
import type { PlanComparison } from '@/lib/compare-plans';
import { formatModelName } from '@/lib/model-names';

export type FaqItem = { question: string; answer: string };

type PlanRow = PlanComparison['officialPlans'][number];

const allRows = (data: PlanComparison): PlanRow[] => [
  ...data.officialPlans,
  ...data.thirdPartyPlans,
];

const hasFree = (rows: PlanRow[]): boolean =>
  rows.some((r) => r.plan.planTier === 'free' || r.pricing.monthly === 0);

const maxDiscount = (rows: PlanRow[]): number | null => {
  let max = 0;
  for (const r of rows) {
    const d = r.pricing.yearlyDiscountPercent;
    if (typeof d === 'number' && Number.isFinite(d) && d > max) max = d;
  }
  return max > 0 ? Math.round(max) : null;
};

export function buildCompareFaqs(
  data: PlanComparison,
  locale: Locale,
): FaqItem[] {
  const isZh = locale === 'zh';
  const rows = allRows(data);
  const { model, summary, officialPlans, thirdPartyPlans } = data;
  const modelName = formatModelName(model.name);
  const cheapest = summary.cheapestPlan;
  const free = hasFree(rows);
  const discount = maxDiscount(rows);
  const chinaRows = rows.filter((r) => r.channel.accessFromChina);
  const faqs: FaqItem[] = [];

  // 1. Cheapest plan
  if (cheapest && typeof cheapest.monthlyPrice === 'number') {
    const priceStr = formatPrice(
      cheapest.monthlyPrice,
      (cheapest.currency || 'USD') as CurrencyCode,
      locale,
    );
    if (isZh) {
      faqs.push({
        question: `包含 ${modelName} 的套餐里，哪个最便宜？`,
        answer:
          `在本站对比的 ${summary.totalPlans} 个套餐中，${cheapest.channel} 的 ${cheapest.name} 价格最低，为 ${priceStr}/月。` +
          (free ? '若用量不大，也有免费套餐可选。' : '') +
          ' 不同产品线（如聊天订阅与编程套餐）并非完全替代品，请按用途选择。',
      });
    } else {
      faqs.push({
        question: `Which subscription plan that includes ${modelName} is the cheapest?`,
        answer:
          `Of the ${summary.totalPlans} plans compared here, ${cheapest.name} on ${cheapest.channel} is the lowest at ${priceStr}/month.` +
          (free ? ' A free tier is also available for light usage.' : '') +
          ' Plans on different product lines (for example a chat subscription versus a coding plan) are not direct substitutes, so pick by use case rather than price alone.',
      });
    }
  }

  // 2. Free tier
  if (free) {
    if (isZh) {
      faqs.push({
        question: `能免费使用 ${modelName} 吗？`,
        answer: '可以。对比中包含免费档位的套餐，可在不付费的情况下体验模型，只是消息数/速率限制较低；升级到付费档位可获得更高额度。',
      });
    } else {
      faqs.push({
        question: `Can I use ${modelName} for free?`,
        answer: 'Yes — the comparison includes plans with a free tier, so you can use the model at no cost with lower message and rate limits; paid tiers raise those limits.',
      });
    }
  }

  // 3. Annual savings — the real number, not "15-20%"
  if (discount) {
    if (isZh) {
      faqs.push({
        question: '年付比月付便宜多少？',
        answer: `根据各套餐官方公布的月付与年付价，年付（折算到每月）最高可比月付省约 ${discount}%。折扣因套餐而异，具体以结账页面为准。`,
      });
    } else {
      faqs.push({
        question: 'How much cheaper is annual versus monthly billing?',
        answer: `Based on each plan's published monthly and annual prices, paying yearly (prorated per month) saves up to ${discount}% versus month-to-month. The exact discount varies by plan — see checkout for a specific tier.`,
      });
    }
  }

  // 4. Official vs third-party
  if (officialPlans.length > 0 && thirdPartyPlans.length > 0) {
    if (isZh) {
      faqs.push({
        question: '官方套餐和第三方渠道有什么区别？',
        answer:
          `本页同时对比 ${officialPlans.length} 个官方套餐和 ${thirdPartyPlans.length} 个第三方/聚合渠道套餐。官方套餐由 ${model.provider.name} 直接销售，权益与计费以官方为准；第三方渠道可能价格更低、支持更多支付方式或提供聚合额度，但模型权限与稳定性以渠道说明为准。`,
      });
    } else {
      faqs.push({
        question: 'What is the difference between official and third-party plans?',
        answer:
          `This page compares ${officialPlans.length} official plan${officialPlans.length === 1 ? '' : 's'} alongside ${thirdPartyPlans.length} third-party or aggregator plans. Official plans are sold directly by ${model.provider.name} with their standard benefits and billing; third-party channels may be cheaper, support more payment methods, or bundle pooled credits, but model access and stability depend on that channel.`,
      });
    }
  }

  // 5. China access
  if (isZh) {
    faqs.push({
      question: `这些套餐在中国大陆能用吗？`,
      answer:
        chinaRows.length > 0
          ? `以下套餐支持中国大陆直连：${chinaRows.slice(0, 4).map((r) => r.channel.name).join('、')}。国内渠道通常支持支付宝/微信付款。`
          : '多数国际官方套餐在中国大陆需要代理或 VPN 才能访问；第三方聚合渠道可能提供国内直连。请以各渠道说明为准。',
    });
  } else {
    faqs.push({
      question: `Can I use these plans from mainland China?`,
      answer:
        chinaRows.length > 0
          ? `These plans are directly reachable from mainland China: ${chinaRows.slice(0, 4).map((r) => r.channel.name).join(', ')}. Domestic channels generally support Alipay/WeChat Pay.`
          : 'Most international official plans require a proxy or VPN from mainland China; some third-party aggregators offer direct domestic access. Check each channel for details.',
    });
  }

  // 6. Data freshness
  if (isZh) {
    faqs.push({
      question: '这些价格多久更新一次？',
      answer: '套餐价格每日从官方与各渠道页面自动抓取，并经只读数据审计交叉核对。功能、限额与价格可能调整，订阅前请以官方结账页面为准。',
    });
  } else {
    faqs.push({
      question: 'How often are these plan prices updated?',
      answer: 'Plan prices are collected daily from official and channel pages and cross-checked by a read-only data audit. Features, limits, and pricing can change — confirm on the official checkout page before subscribing.',
    });
  }

  return faqs;
}
