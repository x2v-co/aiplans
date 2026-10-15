type ProviderLike = {
  slug?: string | null;
  name?: string | null;
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
  seed: '🌋',
  moonshot: '🌙',
  zhipu: '⚡',
  'zhipu-china': '⚡',
  'zhipu-global': '⚡',
  baidu: '☁️',
  minimax: '🎯',
};

// Bundled official favicons (fetched once from each vendor's own site via a
// favicon resolver and committed under public/providers) for providers whose
// DB row has no logo. A DB logo always wins; this is only the fallback.
export const LOCAL_PROVIDER_LOGOS: Record<string, string> = {
  'alibaba-ath': '/providers/alibaba-ath.ico',
  'bfl': '/providers/bfl.png',
  'cohere': '/providers/cohere.ico',
  'decart': '/providers/decart.ico',
  'genmo': '/providers/genmo.png',
  'ibm-granite': '/providers/ibm-granite.ico',
  'inception': '/providers/inception.ico',
  'inclusionai': '/providers/inclusionai.ico',
  'inference-net': '/providers/inference-net.ico',
  'kandinsky': '/providers/kandinsky.png',
  'liquid': '/providers/liquid.ico',
  'manus': '/providers/manus.ico',
  'moonshot': '/providers/moonshot.ico',
  'nex-agi': '/providers/nex-agi.png',
  'noiz-ai': '/providers/noiz-ai.ico',
  'odyssey': '/providers/odyssey.png',
  'perceptron': '/providers/perceptron.png',
  'pixverse': '/providers/pixverse.ico',
  'prism-ml': '/providers/prism-ml.ico',
  'sakana': '/providers/sakana.ico',
  'scaledown': '/providers/scaledown.ico',
  'skywork': '/providers/skywork.ico',
  'subq': '/providers/subq.png',
  'tencent': '/providers/tencent.ico',
  'typesafe': '/providers/typesafe.ico',
  'unbiased': '/providers/unbiased.jpg',
  'upstage': '/providers/upstage.png',
  'vercel-ai-gateway': '/providers/vercel-ai-gateway.png',
  'xiaomi': '/providers/xiaomi.ico',
};

function looksLikeImageSource(value?: string | null): boolean {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:image/');
}

export function getProviderLogoSrc(provider?: ProviderLike | null): string | null {
  if (!provider) return null;
  const candidates = [provider.logoUrl, provider.logo_url, provider.logo];
  return candidates.find((value) => looksLikeImageSource(value))
    || (provider.slug ? LOCAL_PROVIDER_LOGOS[provider.slug] : undefined)
    || null;
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

/** One or two letters for the initials avatar shown when no logo loads. */
export function getProviderInitials(provider?: ProviderLike | null): string {
  const source = (provider?.name || provider?.slug || '').trim();
  if (!source) return '?';
  const words = source.split(/[\s\-_.+]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : [...words[0]].slice(0, 2).join('');
  return letters.toUpperCase();
}

// Image/video/voice catalog rows carry a free-text provider name ("ByteDance
// (BytePlus ModelArk)", "Alibaba Cloud (Qwen)") rather than a DB provider, so
// match on the leading brand word and point at a bundled logo.
const CATALOG_PROVIDER_LOGOS: Array<[RegExp, string]> = [
  [/^google|^gemini|^deepmind/, '/providers/google.png'],
  [/^openai/, '/providers/openai.png'],
  [/^black forest|^bfl/, '/providers/bfl.png'],
  [/^bytedance|^volcano|^byteplus|^seed/, '/providers/bytedance.ico'],
  [/^alibaba-ath/, '/providers/alibaba-ath.ico'],
  [/^alibaba|^qwen|^wan\b/, '/providers/alibaba.ico'],
  [/^microsoft/, '/providers/microsoft.ico'],
  [/^meta/, '/providers/meta.png'],
  [/^xai|^x\.ai/, '/providers/xai.ico'],
  [/^tencent|^hunyuan/, '/providers/tencent.ico'],
  [/^ideogram/, '/providers/ideogram.png'],
  [/^recraft/, '/providers/recraft.png'],
  [/^moondream/, '/providers/moondream.png'],
  [/^runway/, '/providers/runway.png'],
  [/^kuaishou|^kling/, '/providers/kling.png'],
  [/^pika/, '/providers/pika.png'],
  [/^luma/, '/providers/luma-ai.png'],
  [/^shengshu|^vidu/, '/providers/shengshu.png'],
  [/^skyreels/, '/providers/skyreels.png'],
  [/^minimax|^hailuo/, '/providers/minimax.png'],
  [/^genmo/, '/providers/genmo.png'],
  [/^kandinsky/, '/providers/kandinsky.png'],
  [/^spacexsi/, '/providers/spacexsi.svg'],
  [/^pixverse/, '/providers/pixverse.ico'],
  [/^stepfun/, '/providers/stepfun.ico'],
  [/^mistral/, '/providers/mistral.ico'],
];

export function getCatalogProviderLogoSrc(provider?: string | null, slug?: string | null): string | null {
  if (slug && LOCAL_PROVIDER_LOGOS[slug]) return LOCAL_PROVIDER_LOGOS[slug];
  for (const part of [slug, provider]) {
    const value = (part ?? '').toLowerCase().trim();
    if (!value) continue;
    const hit = CATALOG_PROVIDER_LOGOS.find(([pattern]) => pattern.test(value));
    if (hit) return hit[1];
  }
  return null;
}
