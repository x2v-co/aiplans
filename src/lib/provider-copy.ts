/**
 * Data-driven, localized copy for a provider's plan lineup page
 * (`/[locale]/plans/[provider]`).
 *
 * Like model-copy.ts for model detail pages, these pages are core SEO/GEO
 * landing pages (the sitemap lists every provider that has a plan) but used to
 * render only plan cards with no prose and no FAQ. We synthesize a truthful
 * summary and per-provider FAQ from values the page already queried — plan
 * count, starting price (USD-normalized), free tier, the *real* annual
 * discount (computed from price vs price_yearly_monthly, never a hardcoded
 * "15-20%"), China availability, team/enterprise tiers, and model count.
 *
 * If a fact is absent, the sentence that needs it is omitted rather than
 * guessed.
 */
import { convertToUSD } from './currency-conversion';
import { formatPrice, type CurrencyCode } from './currency';
import type { Locale } from './seo';

export interface ProviderCopyPlan {
  name: string;
  price: number | null;
  price_unit: string | null;
  annual_price?: number | null;
  price_yearly_monthly?: number | null;
  tier: string | null;
  plan_kind: string | null;
  monthly_message_limit?: number | null;
  context_window?: number | null;
  access_from_china?: boolean | null;
  is_contact_sales?: boolean | null;
  currency: string | null;
}

export interface ProviderCopyContext {
  name: string;
  type?: string | null;
  region?: string | null;
  access_from_china?: boolean | null;
  description?: string | null;
  plans: ProviderCopyPlan[];
  modelCount: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

interface ProviderCopy {
  summary: string;
  faqs: FaqItem[];
}

const cur = (p: ProviderCopyPlan): CurrencyCode => (p.currency || 'USD') as CurrencyCode;

const isPaid = (p: ProviderCopyPlan): boolean =>
  typeof p.price === 'number' && p.price > 0 && !p.is_contact_sales;

const isFree = (p: ProviderCopyPlan): boolean =>
  !p.is_contact_sales && (p.tier === 'free' || p.price === 0);

function unitLabel(unit: string | null | undefined, locale: Locale): string {
  switch (unit) {
    case 'per_month':
      return locale === 'zh' ? '/月' : '/mo';
    case 'per_year':
      return locale === 'zh' ? '/年' : '/yr';
    case 'per_1m_tokens':
      return locale === 'zh' ? '/1M tokens' : '/1M tokens';
    default:
      return unit ? `/${unit.replace(/_/g, ' ')}` : '';
  }
}

function cheapestPaid(plans: ProviderCopyPlan[]): ProviderCopyPlan | null {
  let best: ProviderCopyPlan | null = null;
  let bestUsd = Infinity;
  for (const p of plans) {
    if (!isPaid(p)) continue;
    const usd = convertToUSD(Number(p.price), cur(p));
    if (Number.isFinite(usd) && usd < bestUsd) {
      bestUsd = usd;
      best = p;
    }
  }
  return best;
}

/** Largest positive annual-billing discount across the provider's monthly plans. */
function maxAnnualDiscount(plans: ProviderCopyPlan[]): number | null {
  let max = 0;
  for (const p of plans) {
    if (!isPaid(p) || p.price_unit !== 'per_month') continue;
    const pym = p.price_yearly_monthly;
    if (typeof pym !== 'number' || pym <= 0 || pym >= Number(p.price)) continue;
    const pct = (1 - pym / Number(p.price)) * 100;
    if (pct > max) max = pct;
  }
  return max > 0 ? Math.round(max) : null;
}

function hasTier(plans: ProviderCopyPlan[], tier: string): boolean {
  return plans.some((p) => p.tier === tier);
}

export function buildProviderCopy(
  ctx: ProviderCopyContext,
  locale: Locale,
): ProviderCopy {
  const isZh = locale === 'zh';
  const { name, plans, modelCount } = ctx;
  const paid = plans.filter(isPaid);
  const freePlans = plans.filter(isFree);
  const contactCount = plans.filter((p) => p.is_contact_sales).length;
  const cheapest = cheapestPaid(plans);
  const discount = maxAnnualDiscount(plans);
  const kinds = new Set(plans.map((p) => p.plan_kind).filter(Boolean));
  const chinaPaid = paid.filter((p) => p.access_from_china);
  const providerInChina = ctx.region === 'china' || ctx.access_from_china;

  // ── Summary ──────────────────────────────────────────────────────────
  const parts: string[] = [];

  if (isZh) {
    let lead = `${name} 共提供 ${plans.length} 个订阅套餐`;
    if (kinds.size > 1) lead += `，覆盖 ${kinds.size} 条产品线`;
    lead += '。';
    parts.push(lead);

    if (cheapest) {
      parts.push(
        `付费套餐最低为 ${cheapest.name}，价格 ${formatPrice(
          Number(cheapest.price),
          cur(cheapest),
          locale,
        )}${unitLabel(cheapest.price_unit, locale)}。`,
      );
    }
    if (freePlans.length > 0) {
      parts.push(
        freePlans.length === 1
          ? `另有免费套餐 ${freePlans[0].name} 可零成本起步。`
          : `另有 ${freePlans.length} 个免费档位可零成本起步。`,
      );
    }
    if (discount) {
      parts.push(`选择年付相较月付最高可省约 ${discount}%。`);
    }
    if (hasTier(plans, 'team') || hasTier(plans, 'enterprise')) {
      const tiers = [
        hasTier(plans, 'team') ? '团队' : null,
        hasTier(plans, 'enterprise') ? '企业' : null,
      ].filter(Boolean) as string[];
      parts.push(`提供${tiers.join('与')}档位${contactCount ? '，企业版按需报价' : ''}。`);
    }
    if (chinaPaid.length > 0) {
      parts.push(`其中 ${chinaPaid.length} 个付费套餐支持中国大陆直连。`);
    } else if (providerInChina) {
      parts.push('该厂商渠道通常支持中国大陆直连与本土支付方式。');
    }
    if (modelCount > 0) {
      parts.push(`这些套餐合计覆盖 ${modelCount} 个模型。`);
    }
    parts.push('价格每日自动抓取官方页面并经数据准确性审计核对。');
  } else {
    let lead = `${name} offers ${plans.length} subscription plan${plans.length === 1 ? '' : 's'}`;
    if (kinds.size > 1) lead += ` across ${kinds.size} product lines`;
    lead += '.';
    parts.push(lead);

    if (cheapest) {
      parts.push(
        `Paid plans start at ${formatPrice(
          Number(cheapest.price),
          cur(cheapest),
          locale,
        )}${unitLabel(cheapest.price_unit, locale)} with ${cheapest.name}.`,
      );
    }
    if (freePlans.length > 0) {
      parts.push(
        freePlans.length === 1
          ? `A free tier (${freePlans[0].name}) is available to get started at no cost.`
          : `${freePlans.length} free tiers are available to get started at no cost.`,
      );
    }
    if (discount) {
      parts.push(`Annual billing saves up to ${discount}% versus paying monthly.`);
    }
    if (hasTier(plans, 'team') || hasTier(plans, 'enterprise')) {
      const tiers = [
        hasTier(plans, 'team') ? 'team' : null,
        hasTier(plans, 'enterprise') ? 'enterprise' : null,
      ].filter(Boolean) as string[];
      parts.push(
        `${tiers[0]!.charAt(0).toUpperCase()}${tiers[0]!.slice(1)}${tiers[1] ? ` and ${tiers[1]}` : ''} tiers are available${contactCount ? ', with enterprise pricing on request' : ''}.`,
      );
    }
    if (chinaPaid.length > 0) {
      parts.push(
        `${chinaPaid.length} paid plan${chinaPaid.length === 1 ? '' : 's'} can be reached directly from mainland China.`,
      );
    } else if (providerInChina) {
      parts.push('This provider generally supports direct access from mainland China and local payment methods.');
    }
    if (modelCount > 0) {
      parts.push(`Together these plans cover ${modelCount} model${modelCount === 1 ? '' : 's'}.`);
    }
    parts.push(
      'Prices are collected daily from the official provider page and cross-checked by a data-accuracy audit.',
    );
  }

  // ── FAQs ─────────────────────────────────────────────────────────────
  const faqs: FaqItem[] = [];

  // 1. Cheapest / starting price
  if (cheapest) {
    const priceStr = `${formatPrice(Number(cheapest.price), cur(cheapest), locale)}${unitLabel(cheapest.price_unit, locale)}`;
    if (isZh) {
      faqs.push({
        question: `${name} 最便宜的订阅套餐是哪个？`,
        answer:
          `在本站收录的套餐中，${cheapest.name} 价格最低，为 ${priceStr}。` +
          (freePlans.length > 0 ? '若用量不大，也可先使用免费档位。' : '') +
          ' 实际价格以官方页面为准，本站每日更新。',
      });
    } else {
      faqs.push({
        question: `What is the cheapest ${name} subscription plan?`,
        answer:
          `Of the plans tracked here, ${cheapest.name} is the cheapest at ${priceStr}.` +
          (freePlans.length > 0 ? ' Light users can also start on the free tier.' : '') +
          ' Confirm on the official site; figures are updated daily.',
      });
    }
  }

  // 2. Free tier
  if (freePlans.length > 0) {
    const names = freePlans.slice(0, 3).map((p) => p.name).join(isZh ? '、' : ', ');
    if (isZh) {
      faqs.push({
        question: `${name} 有免费套餐吗？`,
        answer: `有。${names}${freePlans.length > 3 ? ' 等' : ''}为免费档位，可零成本体验，升级到付费套餐后再获得更高限额与更多模型。`,
      });
    } else {
      faqs.push({
        question: `Does ${name} offer a free plan?`,
        answer: `Yes — ${names}${freePlans.length > 3 ? ', among others,' : ''} ${freePlans.length === 1 ? 'is' : 'are'} available at no cost, with paid tiers adding higher limits and more models.`,
      });
    }
  }

  // 3. Annual savings (real number, not a generic "15-20%")
  if (discount) {
    if (isZh) {
      faqs.push({
        question: `${name} 年付比月付便宜多少？`,
        answer: `按官方公布的月付与年付价计算，年付（折算到每月）最高可比月付省约 ${discount}%。具体折扣因套餐而异，以结账页面为准。`,
      });
    } else {
      faqs.push({
        question: `How much do ${name} annual plans save versus monthly?`,
        answer: `Based on the published monthly and annual prices, paying yearly (prorated per month) saves up to ${discount}% versus month-to-month. The exact discount varies by plan; see checkout for the figure on a specific tier.`,
      });
    }
  }

  // 4. China access
  if (isZh) {
    faqs.push({
      question: `${name} 套餐在中国大陆能用吗？`,
      answer:
        chinaPaid.length > 0
          ? `可以。以下付费套餐支持中国大陆直连：${chinaPaid.slice(0, 4).map((p) => p.name).join('、')}。`
          : providerInChina
            ? '该厂商为国内厂商，其套餐通常支持中国大陆直连，并支持支付宝/微信等本土支付方式。'
            : '本站收录的付费套餐多数不支持中国大陆直连，访问国际版服务通常需要代理或 VPN；具体以官方说明为准。',
    });
  } else {
    faqs.push({
      question: `Can I use ${name} plans from mainland China?`,
      answer:
        chinaPaid.length > 0
          ? `Yes — these paid plans are directly reachable from mainland China: ${chinaPaid.slice(0, 4).map((p) => p.name).join(', ')}.`
          : providerInChina
            ? 'This is a China-based provider, so its plans generally support direct mainland access and local payment methods such as Alipay/WeChat Pay.'
            : 'Most paid plans tracked here are not directly reachable from mainland China; accessing the international service normally requires a proxy or VPN. Check the official terms for details.',
    });
  }

  // 5. Team / enterprise
  if (hasTier(plans, 'team') || hasTier(plans, 'enterprise')) {
    if (isZh) {
      faqs.push({
        question: `${name} 有团队或企业套餐吗？`,
        answer:
          `有。${
            hasTier(plans, 'team') ? '团队套餐按席位计费，适合协作团队' : ''
          }${hasTier(plans, 'team') && hasTier(plans, 'enterprise') ? '；' : ''}${
            hasTier(plans, 'enterprise') ? '企业套餐提供更高限额、SSO/管理控制等能力' : ''
          }${contactCount ? '，企业版价格通常需联系销售获取报价' : ''}。`,
      });
    } else {
      faqs.push({
        question: `Does ${name} have team or enterprise plans?`,
        answer:
          `Yes. ${
            hasTier(plans, 'team') ? 'Team plans are priced per seat for collaborative teams' : ''
          }${hasTier(plans, 'team') && hasTier(plans, 'enterprise') ? '; ' : ''}${
            hasTier(plans, 'enterprise') ? 'enterprise plans add higher limits and controls such as SSO and admin tooling' : ''
          }${contactCount ? ', with enterprise pricing typically available through sales' : ''}.`,
      });
    }
  }

  // 6. Model coverage
  if (modelCount > 0) {
    if (isZh) {
      faqs.push({
        question: `${name} 套餐包含哪些模型？`,
        answer: `本厂商的订阅套餐合计覆盖 ${modelCount} 个模型，可在本页下方“Models”区域查看完整列表，并点击进入各模型详情页对比其 API 渠道价格。`,
      });
    } else {
      faqs.push({
        question: `Which models are included in ${name} plans?`,
        answer: `Across its subscription plans, ${name} covers ${modelCount} model${modelCount === 1 ? '' : 's'}. See the Models section below for the full list, and open any model to compare its API channel prices.`,
      });
    }
  }

  // 7. Data freshness
  if (isZh) {
    faqs.push({
      question: `${name} 的套餐价格多久更新一次？`,
      answer: '价格每日从官方定价页自动抓取，并经只读数据审计交叉核对。套餐功能、限额与价格可能调整，订阅前请以官方结账页面为准。',
    });
  } else {
    faqs.push({
      question: `How often are ${name} plan prices updated?`,
      answer: 'Prices are collected daily from the official pricing page and cross-checked by a read-only data audit. Features, limits, and pricing can change — confirm on the official checkout page before subscribing.',
    });
  }

  return { summary: parts.join(' '), faqs };
}
