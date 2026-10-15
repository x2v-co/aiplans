import type { ScheduledChannelPrice, PriceSchedule } from '../../src/lib/effective-price';

export interface PromoChannel extends ScheduledChannelPrice {
  id: number;
  model_id: number;
  model_slug: string;
  provider_slug: string;
  provider_type: string | null;
  currency: string | null;
  price_unit: string | null;
  notes: string | null;
}
export const PROMO_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';
export const PROMO_MARKER = '[aiplans:same-price-promo]';

/** Only audited standard SKUs, including their existing scraper spellings. */
export function promoModelKey(slug: string): string | null {
  const key = slug.replace(/^google(?:-gemini)?-/, '').replace(/^gemini-3-([68])-flash$/, 'gemini-3.$1-flash');
  return ['gemini-4-argon', 'gemini-3.6-flash', 'gemini-3.8-flash'].includes(key) ? key : null;
}
const same = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
const standardUSD = (row: PromoChannel) => row.currency === 'USD' && row.price_unit === 'per_1m_tokens';
const validSchedule = (row: PromoChannel) => row.input_price_per_1m != null && Number.isFinite(row.input_price_per_1m)
  && row.input_price_per_1m > 0 && row.output_price_per_1m != null && Number.isFinite(row.output_price_per_1m)
  && row.output_price_per_1m >= row.input_price_per_1m && row.promo_ends_at != null
  && Number.isFinite(new Date(row.promo_ends_at).getTime())
  && row.regular_input_price_per_1m != null && Number.isFinite(row.regular_input_price_per_1m) && row.regular_input_price_per_1m > 0
  && row.regular_output_price_per_1m != null && Number.isFinite(row.regular_output_price_per_1m) && row.regular_output_price_per_1m >= row.regular_input_price_per_1m;

export type PromoPatch = PriceSchedule & { notes: string };
export interface PromoChange { id: number; target: string; values: PromoPatch }

/** Copy a source schedule only for an identical standard USD input/output pair. */
export function planPromoSync(rows: PromoChannel[]): PromoChange[] {
  const changes: PromoChange[] = [];
  for (const target of rows) {
    if (!['cloud', 'aggregator', 'reseller'].includes(target.provider_type ?? '') || !standardUSD(target)) continue;
    const key = promoModelKey(target.model_slug);
    if (!key) continue;
    const sources = rows.filter(row => row.provider_slug === 'google'
      && ['official', 'producer'].includes(row.provider_type ?? '') && standardUSD(row)
      && promoModelKey(row.model_slug) === key && validSchedule(row));
    // Ambiguous official rows must be reviewed, never guessed.
    if (sources.length !== 1) continue;
    const source = sources[0];
    if (!same(target.input_price_per_1m, source.input_price_per_1m)
      || !same(target.output_price_per_1m, source.output_price_per_1m)) continue;
    const cacheMatches = same(target.cached_input_price_per_1m, source.cached_input_price_per_1m);
    const regularCache = cacheMatches ? source.regular_cached_input_price_per_1m ?? null : null;
    const cutoff = new Date(source.promo_ends_at!).toISOString();
    const note = `${PROMO_MARKER} Same-price standard input/output schedule from ${PROMO_SOURCE}; cutoff ${cutoff} (Pacific midnight assumed because Google specifies no timezone). Regular input/output $${source.regular_input_price_per_1m}/$${source.regular_output_price_per_1m} per 1M. Reseller cache schedule needs-verification unless its current cache rate matches Google's.`;
    const baseNotes = (target.notes ?? '').split(PROMO_MARKER)[0].trimEnd();
    const values: PromoPatch = {
      promo_ends_at: cutoff,
      regular_input_price_per_1m: source.regular_input_price_per_1m,
      regular_output_price_per_1m: source.regular_output_price_per_1m,
      regular_cached_input_price_per_1m: regularCache,
      notes: [baseNotes, note].filter(Boolean).join('\n'),
    };
    if (Object.entries(values).some(([field, value]) => {
      const old = target[field as keyof PromoChannel] ?? null;
      return field === 'promo_ends_at' && old != null
        ? new Date(old as string | Date).toISOString() !== value : old !== value;
    })) changes.push({ id: target.id, target: `${target.provider_slug}/${target.model_slug}`, values });
  }
  return changes;
}

/** A scraper without schedule fields must not erase an unchanged inherited price. */
export function retainMatchingPromo<T extends ScheduledChannelPrice & { currency?: string | null; price_unit?: string | null }>(
  incoming: T, existing: (ScheduledChannelPrice & { currency?: string | null; price_unit?: string | null }) | null,
): T & PriceSchedule {
  if (!existing?.promo_ends_at || incoming.promo_ends_at !== undefined
    || (incoming.currency ?? 'USD') !== existing.currency
    || (incoming.price_unit ?? 'per_1m_tokens') !== existing.price_unit
    || !same(incoming.input_price_per_1m, existing.input_price_per_1m)
    || !same(incoming.output_price_per_1m, existing.output_price_per_1m)) return incoming;
  return { ...incoming,
    promo_ends_at: existing.promo_ends_at,
    regular_input_price_per_1m: existing.regular_input_price_per_1m,
    regular_output_price_per_1m: existing.regular_output_price_per_1m,
    regular_cached_input_price_per_1m: same(incoming.cached_input_price_per_1m, existing.cached_input_price_per_1m)
      ? existing.regular_cached_input_price_per_1m : null,
  };
}

/** One-time repair values from audit #6; Flash's introductory pair comes from its official DB row. */
export function auditedPromoSources(rows: PromoChannel[]): PromoChannel[] {
  return rows.map(row => {
    const key = promoModelKey(row.model_slug);
    if (!key || row.provider_slug !== 'google' || !['official', 'producer'].includes(row.provider_type ?? '') || !standardUSD(row)) return row;
    return { ...row,
      promo_ends_at: key === 'gemini-4-argon' ? '2026-12-01T08:00:00.000Z' : '2027-01-01T08:00:00.000Z',
      regular_input_price_per_1m: key === 'gemini-4-argon' ? 4 : 1.5,
      regular_output_price_per_1m: key === 'gemini-4-argon' ? 20 : 7.5,
    };
  });
}
