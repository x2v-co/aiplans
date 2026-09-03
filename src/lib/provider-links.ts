export type ProviderLinkSource = {
  slug?: string | null;
  website?: string | null;
  pricing_url?: string | null;
  pricingUrl?: string | null;
  invite_url?: string | null;
  inviteUrl?: string | null;
};

const PROVIDER_LINK_FALLBACKS: Record<string, { api: string; plan?: string }> = {
  openrouter: { api: 'https://openrouter.ai/models' },
};

function safeExternalUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function getProviderVisitUrl(
  provider: ProviderLinkSource | null | undefined,
  intent: 'api' | 'plan' = 'api',
): string | null {
  if (!provider) return null;

  const candidates = intent === 'plan'
    ? [provider.inviteUrl, provider.invite_url, provider.pricingUrl, provider.pricing_url, provider.website]
    : [provider.pricingUrl, provider.pricing_url, provider.website, provider.inviteUrl, provider.invite_url];

  for (const candidate of candidates) {
    const url = safeExternalUrl(candidate);
    if (url) return url;
  }

  const fallback = provider.slug ? PROVIDER_LINK_FALLBACKS[provider.slug] : undefined;
  return safeExternalUrl(intent === 'plan' ? fallback?.plan ?? fallback?.api : fallback?.api);
}
