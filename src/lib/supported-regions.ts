/** Official country support, independent of the vendor's home region.
 * NULL means unresearched; [] means researched support for zero countries.
 * Country lists contain uppercase ISO 3166-1 alpha-2 codes, with no sentinels.
 */
export interface RegionFields {
  supported_regions?: string[] | null;
  regions_source_url?: string | null;
  regions_verified_at?: Date | string | null;
  access_from_china?: boolean | null;
  notes?: string | null;
  last_verified?: Date | string | null;
}

export type RegionEvidence = {
  regions: string[] | null;
  sourceUrl: string | null;
  verifiedAt: Date | string | null;
  includesChina: boolean | null;
  hasSource: boolean;
};

function sourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

const unknown = (): RegionEvidence => ({
  regions: null, sourceUrl: null, verifiedAt: null, includesChina: null, hasSource: false,
});

function researched(row: RegionFields): RegionEvidence {
  const url = sourceUrl(row.regions_source_url);
  const regions = row.supported_regions!;
  return { regions, sourceUrl: url, verifiedAt: row.regions_verified_at ?? null,
    includesChina: regions.includes('CN'), hasSource: url !== null };
}

/** Legacy notes need an explicit China decision AND a support-country URL on
 * the same line AND a verification date. Pricing sources/general notes and
 * last_verified alone never establish that a default boolean was researched.
 * This fallback establishes only CN support, never a full country list.
 */
function legacy(row?: RegionFields | null): RegionEvidence {
  if (row?.access_from_china == null || !row.last_verified
    || !Number.isFinite(new Date(row.last_verified).getTime())) return unknown();
  for (const line of (row.notes ?? '').split(/\r?\n/)) {
    const decision = line.match(/\bChina access:\s*(true|false)\b/i);
    const url = sourceUrl(line.match(/https?:\/\/[^\s<>"\])]+/i)?.[0]);
    if (decision && url && /(?:supported[-_/](?:countries|regions)|countries[-_/](?:and[-_/])?regions)/i.test(new URL(url).pathname)
      && (decision[1].toLowerCase() === 'true') === row.access_from_china) {
      return { regions: null, sourceUrl: url, verifiedAt: row.last_verified,
        includesChina: row.access_from_china, hasSource: true };
    }
  }
  return unknown();
}

export function deriveProviderRegions(provider?: RegionFields | null): RegionEvidence {
  return provider?.supported_regions != null ? researched(provider) : legacy(provider);
}

export function derivePlanRegions(plan: RegionFields, provider?: RegionFields | null): RegionEvidence {
  if (plan.supported_regions != null) return researched(plan);
  if (provider?.supported_regions != null) return researched(provider);
  const own = legacy(plan);
  return own.hasSource ? own : legacy(provider);
}

export function shouldShowChinaBadge(evidence: RegionEvidence, locale: string): boolean {
  return locale === 'zh' && evidence.hasSource && evidence.includesChina === true;
}

/** A compatibility boolean, never the raw default-era database value. */
export function sourcedChinaAccess(evidence: RegionEvidence): boolean | null {
  return evidence.hasSource ? evidence.includesChina : null;
}

export function chinaAccessMark(evidence?: RegionEvidence | null): '✓' | '✗' | '—' {
  const access = evidence ? sourcedChinaAccess(evidence) : null;
  return access === null ? '—' : access ? '✓' : '✗';
}

/** Pass the evidence as well as the list so unsourced rows cannot render. */
export function formatAvailableIn(evidence: RegionEvidence | null | undefined, { locale, maxList = 5 }: {
  locale: string; maxList?: number;
}): string | null {
  if (!evidence?.hasSource || evidence.regions === null) return null;
  const regions = [...new Set(evidence.regions)];
  if (regions.length > maxList) {
    // Round down, so "180+" never overstates a 187-country list.
    const count = Math.floor(regions.length / 10) * 10;
    return count > 0
      ? (locale === 'zh' ? `${count}+ 个国家/地区` : `${count}+ countries`)
      : (locale === 'zh' ? `${regions.length} 个国家/地区` : `${regions.length} countries`);
  }
  return regions.length ? regions.join(', ') : (locale === 'zh' ? '0 个国家/地区' : '0 countries');
}
