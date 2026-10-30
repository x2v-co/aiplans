// Machine annotations are display metadata, not customer-facing copy. Keep
// ordinary bracketed text such as [100K context] intact.
const INTERNAL_MARKER = /\[(?:(?:aiplans|internal|todo|fixme)(?::[^\]\r\n]*)?|[a-z][a-z0-9]*(?:[-_:][a-z0-9]+)+|unverified|needs verification)\]/gi;
const UNVERIFIED_MARKER = /\[(?:needs[-_ ]verification|unverified)\]/i;
const VERIFICATION_SENTENCE = /(?:\bsources?\s*[:：][^\r\n]*?\bverified\s+\d{4}-\d{2}-\d{2}[^.!?。！？\r\n]*[.!?。！？]?|来源\s*[:：][^。！？\r\n]*核验[^。！？\r\n]*[。！？]?)/gi;
const URL_TEXT = /https?:\/\/[^\s<>"）)]+/gi;

export function stripDisplayUrls(text: string): string {
  return text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, '$1')
    .replace(URL_TEXT, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"）)]+/gi, '')
    .replace(/\s+/g, ' ').trim();
}

export interface PlanHighlightFields {
  features?: unknown;
  features_zh?: unknown;
  features_en?: unknown;
  quotas?: unknown;
  limits?: unknown;
  benefits?: unknown;
  price?: number | null;
  annual_price?: number | null;
  price_yearly_monthly?: number | null;
  currency?: string | null;
  price_unit?: string | null;
  tier?: string | null;
  is_contact_sales?: boolean | null;
  payment_methods?: unknown;
  access_from_china?: boolean | null;
  context_window?: number | null;
  monthly_api_credit_usd?: number | null;
  included_tokens?: number | null;
  included_credits?: number | null;
  included_usage_amount?: number | null;
  included_usage_unit?: string | null;
  pack_validity_days?: number | null;
  daily_message_limit?: number | null;
  weekly_message_limit?: number | null;
  monthly_message_limit?: number | null;
  '5_hours_message_limit'?: number | null;
  requests_per_minute?: number | null;
  requests_per_day?: number | null;
  requests_per_month?: number | null;
  tokens_per_minute?: number | null;
  tokens_per_day?: number | null;
  tokens_per_month?: number | null;
  rate_limit?: number | null;
  concurrent_requests?: number | null;
  max_tokens_per_request?: number | null;
}

/** Select authored locale copy; never translate arbitrary vendor prose. */
export function localizedPlanText(value: unknown, locale: string): string[] {
  if (Array.isArray(value)) return value.flatMap(item => localizedPlanText(item, locale));
  if (typeof value === 'string') {
    const hasChinese = /\p{Script=Han}/u.test(uniquePlanSentences([value]).join(' '));
    return (locale === 'zh' ? hasChinese : !hasChinese) ? [value] : [];
  }
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const selected = row[locale] ?? row[`text_${locale}`] ?? row[`description_${locale}`] ?? row.text;
  return selected == null ? [] : localizedPlanText(selected, locale);
}

// Deliberately avoid Intl/host ICU currency glyphs in hydrated card text.
export function planMoney(amount: number, currency: string | null | undefined): string {
  const code = currency || 'USD';
  const symbols: Record<string, string> = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥', KRW: '₩', SGD: 'S$' };
  return `${symbols[code] ?? `${code} `}${amount.toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ',')}`;
}

export function planPriceState(plan: Pick<PlanHighlightFields, 'price' | 'tier' | 'is_contact_sales'>) {
  if (plan.is_contact_sales || (plan.price === 0 && plan.tier !== 'free')) return 'contactSales';
  if (plan.price == null) return 'priceUnknown';
  return plan.tier === 'free' && plan.price === 0 ? 'free' : 'priced';
}

const UNITS: Record<string, [string, string]> = {
  token: ['token', 'tokens'], credit: ['积分', 'credits'], request: ['请求', 'requests'],
  message: ['消息', 'messages'], prompt: ['提示词', 'prompts'],
  generation: ['次生成', 'generations'], second: ['秒', 'seconds'], minute: ['分钟', 'minutes'],
  compute_hour: ['计算小时', 'compute hours'], seat: ['席位', 'seats'], usd: ['美元', 'USD'],
};
const PERIODS: Record<string, [string, string]> = {
  '5h': ['每 5 小时', 'per 5 hours'], day: ['每日', 'per day'], week: ['每周', 'per week'],
  month: ['每月', 'per month'], total: ['总计', 'total'],
};
const LIMITS: Record<string, [string, string]> = {
  daily_message_limit: ['每日消息', 'Messages per day'], weekly_message_limit: ['每周消息', 'Messages per week'],
  monthly_message_limit: ['每月消息', 'Messages per month'], '5_hours_message_limit': ['每 5 小时消息', 'Messages per 5 hours'],
  requests_per_minute: ['每分钟请求', 'Requests per minute'], requests_per_day: ['每日请求', 'Requests per day'],
  requests_per_month: ['每月请求', 'Requests per month'], tokens_per_minute: ['每分钟 token', 'Tokens per minute'],
  tokens_per_day: ['每日 token', 'Tokens per day'], tokens_per_month: ['每月 token', 'Tokens per month'],
  context_window: ['上下文 token', 'Context tokens'], concurrent_requests: ['并发请求', 'Concurrent requests'],
  max_tokens_per_request: ['每次请求最多 token', 'Max tokens per request'],
  included_tokens: ['内含 token', 'Included tokens'], included_credits: ['内含积分', 'Included credits'],
  monthly_api_credit_usd: ['每月 API 额度（美元）', 'Monthly API credit (USD)'],
  pack_validity_days: ['有效天数', 'Validity in days'],
};
const LIMIT_QUOTAS: Record<string, string> = {
  daily_message_limit: 'message:day', weekly_message_limit: 'message:week', monthly_message_limit: 'message:month',
  '5_hours_message_limit': 'message:5h', requests_per_day: 'request:day', requests_per_month: 'request:month',
  tokens_per_day: 'token:day', tokens_per_month: 'token:month', included_tokens: 'token:total', included_credits: 'credit:total',
};

/** Only known keys and explicit values become claims; missing data adds no filler. */
export function structuredPlanHighlights(plan: PlanHighlightFields, locale: string): string[] {
  const i = locale === 'zh' ? 0 : 1;
  const points = localizedPlanText(plan.benefits, locale);
  const quotaFacts = new Set<string>();
  const benefitLabels: Record<string, [string, string]> = {
    web_search: ['支持联网搜索', 'Web search included'], file_upload: ['支持文件上传', 'File uploads included'],
    sso: ['支持单点登录', 'SSO included'], priority_support: ['提供优先支持', 'Priority support included'],
  };
  for (const value of [plan.features, plan.benefits]) if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, labels] of Object.entries(benefitLabels))
      if ((value as Record<string, unknown>)[key] === true) points.push(labels[i]);
  }
  if (Array.isArray(plan.quotas)) for (const value of plan.quotas) {
    if (!value || typeof value !== 'object') continue;
    const q = value as Record<string, unknown>;
    const period = PERIODS[String(q.period)];
    const unit = UNITS[String(q.unit)];
    if (typeof q.amount === 'number' && Number.isFinite(q.amount) && q.amount >= 0 && period && unit) {
      quotaFacts.add(`${q.unit}:${q.period}:${q.amount}`);
      const derived = typeof q.derived_from === 'string';
      points.push(i === 0 ? `套餐记录${derived ? '估算' : ''}额度：${period[0]} ${q.amount} ${unit[0]}` : `Recorded ${derived ? 'estimated ' : ''}plan allowance: ${q.amount} ${unit[1]} ${period[1]}`);
    } else if (q.unit === 'relative' && typeof q.multiplier === 'number' && q.multiplier > 0
      && Number.isFinite(q.multiplier) && typeof q.derived_from === 'string' && period) {
      points.push(i === 0 ? `${period[0]}用量：${q.derived_from} 的 ${q.multiplier} 倍` : `Usage ${period[1]}: ${q.multiplier}× ${q.derived_from}`);
    }
  }
  const limits = plan.limits && typeof plan.limits === 'object' && !Array.isArray(plan.limits)
    ? plan.limits as Record<string, unknown> : {};
  for (const [key, labels] of Object.entries(LIMITS)) {
    const value = plan[key as keyof PlanHighlightFields] ?? limits[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0
      && !quotaFacts.has(`${LIMIT_QUOTAS[key]}:${value}`)) points.push(`${labels[i]}${i === 0 ? '：' : ': '}${value}`);
  }
  if (plan.requests_per_minute == null && limits.requests_per_minute == null
    && typeof plan.rate_limit === 'number' && Number.isFinite(plan.rate_limit) && plan.rate_limit >= 0)
    points.push(`${i === 0 ? '每分钟请求：' : 'Requests per minute: '}${plan.rate_limit}`);
  const usageUnit = UNITS[plan.included_usage_unit || ''];
  if (usageUnit && typeof plan.included_usage_amount === 'number' && Number.isFinite(plan.included_usage_amount) && plan.included_usage_amount >= 0)
    points.push(`${i === 0 ? '内含用量：' : 'Included usage: '}${plan.included_usage_amount} ${usageUnit[i]}`);
  const state = planPriceState(plan);
  const period = plan.price_unit === 'per_year' ? ['年', 'year'] : !plan.price_unit || plan.price_unit === 'per_month' ? ['月', 'month'] : null;
  if (state === 'contactSales') points.push(i === 0 ? '联系销售/询价' : 'Contact sales / Request a quote');
  else if (plan.price != null && period) points.push(i === 0 ? `套餐价格：${planMoney(plan.price, plan.currency)}/${period[0]}` : `Plan price: ${planMoney(plan.price, plan.currency)}/${period[1]}`);
  if (state !== 'contactSales' && plan.annual_price != null)
  {
    const ymValue = plan.price_yearly_monthly == null ? NaN : Number(plan.price_yearly_monthly);
    const ym = Number.isFinite(ymValue) && ymValue > 0 ? planMoney(ymValue, plan.currency) : null;
    const annual = planMoney(plan.annual_price, plan.currency);
    points.push(i === 0
      ? `年付 ${annual}${ym ? `（折合 ${ym}/月）` : ''}`
      : `Billed annually ${annual}${ym ? ` (${ym}/month)` : ''}`);
  }
  const paymentLabels: Record<string, [string, string]> = {
    Alipay: ['支付宝', 'Alipay'], 'WeChat Pay': ['微信支付', 'WeChat Pay'],
    'Credit Card': ['信用卡', 'Credit card'], 'Debit Card': ['借记卡', 'Debit card'],
    'Apple Pay': ['Apple Pay', 'Apple Pay'], 'Google Pay': ['Google Pay', 'Google Pay'],
    Invoice: ['发票付款', 'Invoice'], Contract: ['合同付款', 'Contract'],
  };
  const payments = Array.isArray(plan.payment_methods) ? plan.payment_methods.flatMap(key =>
    typeof key === 'string' && paymentLabels[key] ? [paymentLabels[key][i]] : []) : [];
  if (payments.length) points.push(`${i === 0 ? '付款方式：' : 'Payment methods: '}${payments.join(' / ')}`);
  if (plan.access_from_china === true) points.push(i === 0 ? '支持中国大陆访问' : 'Accessible from mainland China');
  return uniquePlanSentences(points);
}

export function cleanPlanDisplayText(value: unknown): { text: string; unverified: boolean } {
  if (typeof value !== 'string') return { text: '', unverified: false };
  return {
    text: value.replace(INTERNAL_MARKER, '').replace(/\s+/g, ' ').trim(),
    unverified: UNVERIFIED_MARKER.test(value),
  };
}

function sentenceKey(text: string): string {
  return text.toLowerCase().replace(/[.!?。！？]+$/, '').trim();
}

/** Deduplicate sentences across features, quotas, notes and conditions in order. */
export function uniquePlanSentences(values: readonly unknown[], seenText: readonly unknown[] = []): string[] {
  const sentences = (items: readonly unknown[]) => items.flatMap(value => {
    if (typeof value !== 'string') return [];
    // URLs have a single labeled link on the card, rather than prose copies.
    const text = value.replace(VERIFICATION_SENTENCE, '').split(/[\r\n]+/u).map(stripDisplayUrls)
      .map(item => cleanPlanDisplayText(item).text.replace(/^(?:source|来源|原文)\s*[:：]\s*/i, ''))
      .filter(Boolean)
      .join(' ');
    return text.split(/(?<=[。！？])\s*|(?<=[.!?])\s+/u)
      .map(item => item.replace(/^(?:sources?|来源|原文)\s*[:：]\s*/i, '').trim()).filter(Boolean);
  });
  const seen = new Set(sentences(seenText).map(sentenceKey));
  return sentences(values).filter(text => {
    const key = sentenceKey(text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function planCardCopy(input: {
  name: string;
  features: unknown;
  locale?: string;
  structured?: PlanHighlightFields;
  conditions?: readonly unknown[];
  notes?: string | null;
  sourceLabel?: string;
}) {
  const locale = input.locale ?? 'en';
  const authoredFeatures = locale === 'zh' ? input.structured?.features_zh : input.structured?.features_en;
  const authored = localizedPlanText(authoredFeatures, locale);
  const features = authored.length ? authored : typeof input.features === 'string' ? [] : localizedPlanText(input.features, locale);
  const generated = input.structured ? structuredPlanHighlights(input.structured, locale) : [];
  const conditions = input.conditions ?? [];
  const name = cleanPlanDisplayText(input.name).text;
  const points = uniquePlanSentences([...features, ...generated], [name, input.sourceLabel])
    .filter(text => localizedPlanText(text, locale).length > 0);
  const hasMarker = (value: unknown): boolean => cleanPlanDisplayText(value).unverified
    || (Array.isArray(value) ? value.some(hasMarker)
      : value != null && typeof value === 'object' && Object.values(value).some(hasMarker));
  return {
    name,
    points: points.slice(0, 4),
    details: [
      ...points.slice(4),
      ...uniquePlanSentences(localizedPlanText([...conditions, input.notes], locale), [name, ...points, input.sourceLabel])
        .filter(text => localizedPlanText(text, locale).length > 0),
    ],
    unverified: [input.name, input.features, authoredFeatures, ...conditions, input.notes, input.sourceLabel].some(hasMarker),
  };
}
