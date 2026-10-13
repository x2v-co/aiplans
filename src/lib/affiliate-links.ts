/**
 * Affiliate (referral) links for user-facing outbound CTAs.
 *
 * Rules:
 * - Only user-facing "open / try" CTAs use these URLs. Pricing source URLs used
 *   by scrapers and cited as data sources stay on the official vendor domain.
 * - Every rendered affiliate link must use AFFILIATE_LINK_REL and show the
 *   commission disclosure next to it (see AffiliateDisclosure).
 * - Do not use partner brand terms in SEO titles, slugs or domains.
 */
export const AFFILIATE_LINK_REL = 'sponsored nofollow noopener noreferrer';

const AFFILIATE_LINKS: Record<string, { url: string; hosts: string[] }> = {
  elevenlabs: {
    url: 'https://try.elevenlabs.io/te0zrkmvym3j',
    hosts: ['elevenlabs.io', 'www.elevenlabs.io'],
  },
};

function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Affiliate URL for a provider slug, if we have a partnership. */
export function getAffiliateUrl(providerSlug: string | undefined | null): string | undefined {
  if (!providerSlug) return undefined;
  return AFFILIATE_LINKS[providerSlug.toLowerCase()]?.url;
}

/**
 * Resolve a user-facing outbound link: official vendor URLs for partner
 * providers are swapped for the affiliate URL.
 */
export function resolveOutboundLink(
  url: string | undefined | null,
  providerSlug?: string | null,
): { href: string; affiliate: boolean } | null {
  const host = hostOf(url);
  for (const [slug, entry] of Object.entries(AFFILIATE_LINKS)) {
    if ((host && entry.hosts.includes(host)) || (!url && providerSlug?.toLowerCase() === slug)) {
      return { href: entry.url, affiliate: true };
    }
  }
  return url ? { href: url, affiliate: false } : null;
}

export function affiliateDisclosureText(locale: string): string {
  return locale === 'zh'
    ? '联盟推广链接：通过此链接注册或购买，我们可能获得佣金，你无需额外付费。'
    : 'Affiliate link — we may earn a commission, at no extra cost to you.';
}
