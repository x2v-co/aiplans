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
 * Keep exactly one entry per productId. Preference: the entry whose scraped
 * slug equals the model's slug (the canonical listing); otherwise the first
 * one in scraper order. Returns the kept entries (in first-seen order) and the
 * dropped ones for logging.
 */
export function pickCanonicalPerProduct<P>(entries: ResolvedEntry<P>[]): {
  kept: ResolvedEntry<P>[];
  dropped: ResolvedEntry<P>[];
} {
  const chosen = new Map<number, ResolvedEntry<P>>();
  const order: number[] = [];
  for (const entry of entries) {
    const current = chosen.get(entry.productId);
    if (!current) {
      chosen.set(entry.productId, entry);
      order.push(entry.productId);
      continue;
    }
    const currentExact = current.scrapedSlug === current.productSlug;
    const entryExact = entry.scrapedSlug === entry.productSlug;
    if (!currentExact && entryExact) chosen.set(entry.productId, entry);
  }
  const keptSet = new Set(chosen.values());
  return {
    kept: order.map((id) => chosen.get(id)!),
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
