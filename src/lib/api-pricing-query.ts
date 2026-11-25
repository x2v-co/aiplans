export type CatalogSort = 'selected' | 'price' | 'name' | 'elo' | 'latest' | 'context';
export interface CatalogQuery {
  locale: 'en' | 'zh';
  q: string;
  sort: CatalogSort;
  order: 'asc' | 'desc';
  region: 'all' | 'global' | 'china';
  channel: 'all' | 'official' | 'cloud' | 'aggregator' | 'reseller';
  china: boolean;
  promo: boolean;
  offset: number;
}

export const CATALOG_PAGE_SIZE = 50;
export const CHANNEL_PAGE_SIZE = 8;
export const VARIANT_PAGE_SIZE = 12;
export const MAX_CATALOG_OFFSET = 100_000;

/** Strict endpoint validation happens before any catalog read. */
export function parseCatalogRequest(params: URLSearchParams) {
  const allowed = new Set(['locale', 'q', 'sort', 'order', 'region', 'channel', 'china', 'promo', 'offset', 'mode', 'slug', 'channelId']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new Error('Invalid catalog query');
  }
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!values.includes(value as T)) throw new Error(`Invalid ${key}`);
    return value as T;
  };
  const mode = choice('mode', ['list', 'channels', 'variants'], 'list');
  const locale = choice('locale', ['en', 'zh'], 'en');
  const q = (params.get('q') ?? '').trim();
  if (q.length > 128 || /[\u0000-\u001f\u007f]/.test(q)) throw new Error('Invalid search');
  const rawOffset = params.get('offset') ?? '0';
  if (!/^(0|[1-9]\d{0,5})$/.test(rawOffset) || Number(rawOffset) > MAX_CATALOG_OFFSET) throw new Error('Invalid offset');
  const offset = Number(rawOffset);
  const query: CatalogQuery = {
    locale, q, offset,
    sort: choice('sort', ['selected', 'price', 'name', 'elo', 'latest', 'context'], 'selected'),
    order: choice('order', ['asc', 'desc'], 'desc'),
    region: choice('region', ['all', 'global', 'china'], 'all'),
    channel: choice('channel', ['all', 'official', 'cloud', 'aggregator', 'reseller'], 'all'),
    china: choice('china', ['0', '1'], '0') === '1' && locale === 'zh',
    promo: choice('promo', ['0', '1'], '0') === '1',
  };
  const slug = params.get('slug') ?? '';
  const channelId = params.get('channelId');
  if (mode !== 'list' && (!slug || slug.length > 200 || /[\s/\\\u0000-\u001f]/.test(slug))) throw new Error('Invalid slug');
  if (mode === 'variants' && (!channelId || !/^[1-9]\d{0,9}$/.test(channelId))) throw new Error('Invalid channel');
  if (mode === 'list' && (slug || channelId) || mode === 'channels' && channelId) throw new Error('Invalid query combination');
  return { mode, query, slug, channelId: Number(channelId) };
}

export function catalogQueryParams(query: CatalogQuery): URLSearchParams {
  return new URLSearchParams({ locale: query.locale, q: query.q, sort: query.sort, order: query.order,
    region: query.region, channel: query.channel, china: query.china ? '1' : '0', promo: query.promo ? '1' : '0', offset: String(query.offset) });
}
