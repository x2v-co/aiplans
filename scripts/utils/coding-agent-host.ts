/**
 * Host-model slug resolution for Artificial Analysis coding-agent records.
 *
 * Until mid-Oct 2026 every record carried `hostModelSlug` (e.g.
 * "anthropic_claude-opus-5"). The 2026-10-16 snapshot dropped that field from
 * all records; the host model is now only exposed as `display.model`
 * ("Sonnet 5.5 (max)") plus `modelCreators[].slug`. Derive an equivalent
 * `provider_model` slug from those so mapping keeps working, and report
 * records with neither so the caller can skip them instead of crashing.
 */
export interface HostFields {
  hostModelSlug?: unknown;
  display?: { model?: unknown } | null;
  modelCreators?: Array<{ slug?: unknown }> | null;
  provider?: unknown;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // reasoning-effort / fallback qualifiers
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns the host slug, or null when the record carries no usable host info. */
export function deriveHostModelSlug(record: HostFields): string | null {
  if (typeof record.hostModelSlug === 'string' && record.hostModelSlug.trim()) return record.hostModelSlug;
  const model = record.display?.model;
  if (typeof model !== 'string') return null;
  const modelPart = slugify(model);
  if (!modelPart) return null;
  const creator = record.modelCreators?.find((entry) => typeof entry?.slug === 'string')?.slug;
  const provider = typeof creator === 'string' ? creator : typeof record.provider === 'string' ? record.provider : null;
  return provider ? `${provider}_${modelPart}` : modelPart;
}
