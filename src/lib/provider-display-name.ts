type ProviderName = { name?: string | null; name_en?: string | null; slug?: string | null };

const EN_NAMES: Record<string, string> = {
  moonshot: 'Moonshot AI / Kimi', kimi: 'Moonshot AI / Kimi',
  'moonshot-ai': 'Moonshot AI / Kimi',
  'zhipu-china': 'Zhipu AI / Z.ai', 'zhipu-global': 'Zhipu AI / Z.ai',
  zhipu: 'Zhipu AI / Z.ai', zai: 'Zhipu AI / Z.ai',
  seed: 'Volcengine / Seed', 'opencode-go': 'OpenCode Go',
};

export function providerDisplayName(provider: ProviderName | null | undefined, locale: string): string {
  if (!provider) return '';
  if (locale === 'zh') return provider.name || '';
  return provider.name_en?.trim() || EN_NAMES[provider.slug || '']
    || (/月之暗面|Moonshot\/Kimi/i.test(provider.name || '') ? EN_NAMES.moonshot
      : /智谱/.test(provider.name || '') ? EN_NAMES.zhipu : provider.name || '');
}

export function localizeProvider<T extends ProviderName>(provider: T | null, locale: string): T | null {
  return provider ? { ...provider, name: providerDisplayName(provider, locale) } : null;
}
