type ProviderLike = {
  slug?: string | null;
  logo?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
};

const PROVIDER_EMOJI: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  google: '✨',
  deepseek: '🔍',
  mistral: '🌪️',
  xai: '🤠',
  meta: '🦙',
  qwen: '🐱',
  volcengine: '🔥',
  moonshot: '🌙',
  zhipu: '⚡',
  'zhipu-china': '⚡',
  'zhipu-global': '⚡',
  baidu: '☁️',
  minimax: '🎯',
};

function looksLikeImageSource(value?: string | null): boolean {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:image/');
}

export function getProviderLogoSrc(provider?: ProviderLike | null): string | null {
  if (!provider) return null;
  const candidates = [provider.logoUrl, provider.logo_url, provider.logo];
  return candidates.find((value) => looksLikeImageSource(value)) || null;
}

export function getProviderLogoFallback(provider?: ProviderLike | null, fallback = '🏢'): string {
  if (!provider) return fallback;
  if (provider.logo && !looksLikeImageSource(provider.logo)) {
    return provider.logo;
  }
  if (provider.slug && PROVIDER_EMOJI[provider.slug]) {
    return PROVIDER_EMOJI[provider.slug];
  }
  return fallback;
}
