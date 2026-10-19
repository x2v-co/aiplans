/**
 * 审计（2026-10-15）把 OpenRouter 上没有固定单价的路由模型（-1 哨兵，如
 * typesafe/jev-router、nvidia/switchyard）记为 价格 NULL + is_available=false。
 * 任何写入方只要不给出真实数字价格，就不能把这类人工下架行改回可用。
 */
export const VARIABLE_ROUTER_SENTINEL = '[needs-verification] Variable/router pricing';

type ExistingRow = { is_available?: boolean | null; notes?: string | null; availability_locked?: boolean | null } | null | undefined;
type Incoming = { is_available: boolean; input_price_per_1m: number | null; output_price_per_1m: number | null };

export function isManuallyUnavailable(existing: ExistingRow): boolean {
  return existing?.is_available === false && String(existing.notes ?? '').includes(VARIABLE_ROUTER_SENTINEL);
}

/**
 * A channel taken down by a person or a data seed (discontinued, retired, past
 * shutdown_date) carries availability_locked=true. Scrapers still refresh its
 * price, but never turn it back on; clearing the lock is an explicit SQL step.
 */
export function isAvailabilityLocked(existing: ExistingRow): boolean {
  return existing?.is_available === false && existing?.availability_locked === true;
}

export function retainLockedUnavailable<T extends { is_available: boolean }>(data: T, existing: ExistingRow): T {
  return data.is_available && isAvailabilityLocked(existing) ? { ...data, is_available: false } : data;
}

export function retainManualUnavailable<T extends Incoming>(data: T, existing: ExistingRow): T {
  if (data.is_available && isAvailabilityLocked(existing)) return { ...data, is_available: false };
  if (!data.is_available || !isManuallyUnavailable(existing)) return data;
  const priced = Number.isFinite(data.input_price_per_1m as number) && Number.isFinite(data.output_price_per_1m as number)
    && data.input_price_per_1m != null && data.output_price_per_1m != null;
  return priced ? data : { ...data, is_available: false };
}

/** Scraper soft-retirement marker (index-dynamic / queries retireUnseen*). */
const SCRAPE_RETIRED = /\|?\s*retired \S+: absent from successful full-catalog [^|]*$/;

export function isScrapeRetired(existing: ExistingRow): boolean {
  return existing?.is_available === false && SCRAPE_RETIRED.test(String(existing.notes ?? ''));
}

/**
 * Seed/audit writers must not resurrect a row that is unavailable in the DB because it has no real
 * price (-1 sentinel) or because the live scrape retired it as delisted. Keeps is_available=false
 * and the retirement suffix in notes, so a re-run is a no-op instead of a false→true flip.
 */
export function keepUnavailableForSeed<T extends Incoming & { notes?: string }>(data: T, existing: ExistingRow): T {
  if (!data.is_available || existing?.is_available !== false) return data;
  const priced = data.input_price_per_1m != null && data.output_price_per_1m != null
    && Number.isFinite(data.input_price_per_1m) && Number.isFinite(data.output_price_per_1m);
  if (!priced || isManuallyUnavailable(existing) || isAvailabilityLocked(existing)) return { ...data, is_available: false };
  if (isScrapeRetired(existing)) {
    const suffix = String(existing!.notes).match(SCRAPE_RETIRED)![0].replace(/^\s*\|?\s*/, '');
    return { ...data, is_available: false, notes: data.notes ? `${data.notes} | ${suffix}` : suffix };
  }
  return data;
}
