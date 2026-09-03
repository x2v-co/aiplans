import { pickNewestPerSeries } from './model-series';

export type FreshModel = {
  slug: string;
  released_at?: string | Date | null;
  created_at?: string | Date | null;
};

/** Prefer a source release date, falling back to when we first discovered it. */
export function modelFreshnessTime(model: FreshModel): number {
  const value = model.released_at ?? model.created_at;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Hide channel-only SKUs from discovery surfaces while keeping them searchable. */
export function isPrimaryModelVariant(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return normalized.length <= 80 && !/(?:\(batch\)|:batch|-batch|\(free\)|:free|-free|\(exacto\)|:exacto|-exacto|-highspeed|-fast|-us)$/.test(normalized);
}

export function pickLatestModels<T extends FreshModel>(items: T[], limit = 8): T[] {
  const available = items
    .filter((item) => isPrimaryModelVariant(item.slug) && modelFreshnessTime(item) > 0)
    .sort((a, b) => modelFreshnessTime(b) - modelFreshnessTime(a));

  return pickNewestPerSeries(available, (item) => item.slug)
    .sort((a, b) => modelFreshnessTime(b) - modelFreshnessTime(a))
    .slice(0, limit);
}
