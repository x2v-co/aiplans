import { formatModelName } from './model-names';

/** Spelling variants only: keep version numbers and variant suffixes intact. */
export function modelAliases(name: string, slug: string): string[] {
  const aliases = new Set<string>();
  for (const source of [slug, name]) {
    const normalized = formatModelName(source).toLowerCase()
      .replace(/[_\s\u2010-\u2015]+/g, '-');
    const bases = [normalized, normalized.replace(/^(?:openai|anthropic|zai|z\.ai)-/, '')];
    for (const base of bases) {
      aliases.add(base);
      aliases.add(base.replace(/-/g, ' '));
      aliases.add(base.replace(/-/g, ''));
      // glm5.3-flash / glm5.3 flash / sonnet5.5 / deepseekv4 flash
      const joinedVersion = base.replace(/([a-z])-(?=[vk]?\d)/g, '$1');
      aliases.add(joinedVersion);
      aliases.add(joinedVersion.replace(/-/g, ' '));
      if (base.startsWith('claude-')) {
        const short = base.slice('claude-'.length);
        aliases.add(short);
        aliases.add(short.replace(/-/g, ' '));
        aliases.add(short.replace(/-/g, ''));
      }
    }
  }
  aliases.delete(name.toLowerCase());
  return [...aliases].filter(Boolean);
}
