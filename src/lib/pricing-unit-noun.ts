import { labelNonLlmPriceKey } from './non-llm-price-labels';

/**
 * The billing unit a model page states in its title, meta description, FAQ and
 * JSON-LD. models.pricing_unit and usage_prices.unit both spell units several
 * ways ('per_second', 'second', '1K characters'); normalize them so the head of
 * the page says what the price table says. eleven-v4 (2026-11-04) is billed per
 * 1K characters but its title claimed "Price per 1M tokens".
 */
export interface PricingUnitNoun {
  /** Normalized key without the `per_` prefix, e.g. '1k_characters', 'second'. */
  key: string;
  /** Token-metered: the existing input/output/cache-read copy applies. */
  isToken: boolean;
  en: string;
  zh: string;
}

const NOUNS: Record<string, [en: string, zh: string]> = {
  '1m_tokens': ['1M tokens', '百万 tokens'],
  '1k_tokens': ['1K tokens', '千 tokens'],
  token: ['token', 'token'],
  '1k_characters': ['1K characters', '千字符'],
  '1m_characters': ['1M characters', '百万字符'],
  character: ['character', '字符'],
  second: ['second', '秒'],
  minute: ['minute', '分钟'],
  hour: ['hour', '小时'],
  compute_hour: ['compute hour', '计算小时'],
  generation: ['generation', '次生成'],
  image: ['image', '张图片'],
  megapixel: ['megapixel', '百万像素'],
  credit: ['credit', '积分'],
  song: ['song', '首歌曲'],
  request: ['request', '次请求'],
  task: ['task', '次任务'],
  '1m_tasks': ['1M tasks', '百万次任务'],
};

const ALIASES: Record<string, string> = {
  '1m_token': '1m_tokens', tokens: 'token', '1k_character': '1k_characters', '1m_character': '1m_characters',
  characters: 'character', seconds: 'second', sec: 'second', s: 'second', minutes: 'minute', min: 'minute',
  hours: 'hour', generations: 'generation', images: 'image', megapixels: 'megapixel', credits: 'credit',
  songs: 'song', requests: 'request', tasks: 'task',
};

/** Units that are not a metered rate: nothing to state per unit. */
const NOT_A_RATE = new Set(['', 'unknown', 'subscription_only', 'subscription', 'contract', 'undisclosed']);

export function normalizePricingUnit(unit: string | null | undefined): string | null {
  if (unit == null) return null;
  let key = unit.trim().toLowerCase().replace(/^per[\s_-]+/, '').replace(/[\s-]+/g, '_');
  key = ALIASES[key] ?? key;
  return NOT_A_RATE.has(key) ? null : key;
}

export function pricingUnitNoun(unit: string | null | undefined): PricingUnitNoun | null {
  const key = normalizePricingUnit(unit);
  if (key == null) return null;
  const known = NOUNS[key];
  const isToken = /(^|_)tokens?$/.test(key);
  if (known) return { key, isToken, en: known[0], zh: known[1] };
  // Unlisted unit: reuse the catalog label, minus any leading "per"/"每".
  const strip = (label: string) => label.replace(/^per\s+/i, '').replace(/^每/, '').trim();
  return { key, isToken, en: strip(labelNonLlmPriceKey(unit!, 'en')), zh: strip(labelNonLlmPriceKey(unit!, 'zh')) };
}

export const TOKEN_UNIT: PricingUnitNoun = { key: '1m_tokens', isToken: true, en: NOUNS['1m_tokens'][0], zh: NOUNS['1m_tokens'][1] };
