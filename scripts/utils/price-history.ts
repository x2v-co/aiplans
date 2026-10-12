/**
 * Helpers that keep api_channel_prices / price_history consistent within one
 * scrape round.
 *
 * Bug fixed here (2026-10-12): several scraped entries from one source can
 * resolve to the same model row (dated snapshots, -16k / -instruct variants,
 * or a name-based match in getOrCreateProduct). Each entry then upserted the
 * same (model_id, provider_id) row in turn and logged a price_history row
 * against the previous entry's value, so one scrape produced 4-5 history rows
 * per model with cycling values (e.g. gpt-3.5-turbo 0.5 -> 1 -> 1.5 -> 3 -> 0.5)
 * and the published price was whichever entry came last.
 */

export interface ResolvedEntry<P> {
  productId: number;
  productSlug: string;
  /** Slug the scraper produced for this entry. */
  scrapedSlug: string;
  price: P;
}

/**
 * Comparable key for a slug: lowercase, `/` -> `-`, so OpenRouter's
 * `qwen/qwen3-30b-a3b` and the catalog's `qwen-qwen3-30b-a3b` agree.
 */
export function slugKey(slug: string): string {
  return slug.toLowerCase().replace(/\//g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Same key with a leading provider segment dropped (`qwen-qwen3-30b-a3b` -> `qwen3-30b-a3b`). */
function withoutProvider(key: string): string {
  const i = key.indexOf('-');
  return i > 0 ? key.slice(i + 1) : key;
}

/**
 * 2 = scraped slug is the model's slug; 1 = equal once a provider prefix is
 * dropped on either side; 0 = a variant that merely resolved to this model.
 */
export function matchRank(scrapedSlug: string, productSlug: string): number {
  const a = slugKey(scrapedSlug);
  const b = slugKey(productSlug);
  if (a === b) return 2;
  if (withoutProvider(a) === b || a === withoutProvider(b) || withoutProvider(a) === withoutProvider(b)) return 1;
  return 0;
}

/**
 * Keep exactly one entry per productId: the best-ranked match (see
 * matchRank); ties keep scraper order. A variant can only win when no exact
 * entry for that model is in the batch. Returns kept entries (first-seen
 * order) and the dropped ones for logging.
 */
export function pickCanonicalPerProduct<P>(entries: ResolvedEntry<P>[]): {
  kept: ResolvedEntry<P>[];
  dropped: ResolvedEntry<P>[];
} {
  const chosen = new Map<number, { entry: ResolvedEntry<P>; rank: number }>();
  const order: number[] = [];
  for (const entry of entries) {
    const rank = matchRank(entry.scrapedSlug, entry.productSlug);
    const current = chosen.get(entry.productId);
    if (!current) {
      chosen.set(entry.productId, { entry, rank });
      order.push(entry.productId);
    } else if (rank > current.rank) {
      chosen.set(entry.productId, { entry, rank });
    }
  }
  const keptSet = new Set([...chosen.values()].map((c) => c.entry));
  return {
    kept: order.map((id) => chosen.get(id)!.entry),
    dropped: entries.filter((e) => !keptSet.has(e)),
  };
}

const EPSILON = 1e-9;

function pct(oldValue: number | null | undefined, newValue: number): number {
  if (oldValue == null || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * History is recorded on any real change of input OR output price (not only
 * >20% input moves, which silently dropped e.g. output-only changes).
 * change_percent is the input move, or the output move when input is flat.
 */
export function describePriceChange(
  old: { input: number | null | undefined; output: number | null | undefined },
  next: { input: number; output: number },
): { changed: boolean; changePercent: number } {
  const inputChanged = old.input == null || Math.abs(old.input - next.input) > EPSILON;
  const outputChanged = old.output == null || Math.abs(old.output - next.output) > EPSILON;
  if (!inputChanged && !outputChanged) return { changed: false, changePercent: 0 };
  const changePercent = inputChanged ? pct(old.input, next.input) : pct(old.output, next.output);
  return { changed: true, changePercent };
}
