/**
 * Shared helpers for ingesting Artificial Analysis leaderboards.
 *
 * Every AA page (model leaderboard, coding agents, ...) is a Next.js App Router
 * page whose data rides along in the RSC flight payload
 * (`self.__next_f.push([1,"..."])`) embedded in the initial HTML. There is no
 * separate JSON API: parse the flight chunks out of the document and locate
 * the array/object you need by balanced-bracket extraction.
 */

export const AA_USER_AGENT = 'aiplans.dev benchmark importer (+https://aiplans.dev/methodology)';

/** Concatenate all RSC flight string chunks embedded in an AA HTML document. */
export function parseNextFlight(html: string): string {
  const chunks: string[] = [];
  const scriptPattern = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  for (const match of html.matchAll(scriptPattern)) {
    const payload = JSON.parse(match[1]) as [number, unknown];
    if (typeof payload[1] === 'string') chunks.push(payload[1]);
  }
  if (chunks.length === 0) {
    throw new Error('No Next.js flight payload found in Artificial Analysis page');
  }
  return chunks.join('');
}

/** Extract the balanced JSON array beginning at `text[start] === '['`. */
export function extractBalancedArray(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('Artificial Analysis payload array was truncated');
}

/** Extract the balanced JSON object beginning at `text[start] === '{'`. */
export function extractBalancedObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('Artificial Analysis payload object was truncated');
}

/**
 * Candidate local-model slugs for an Artificial Analysis model slug.
 *
 * AA variants carry suffixes/formatting our catalog does not use
 * (`gpt-5-4` vs `gpt-5.4`, `-xhigh` effort tags, `-preview`, date stamps).
 * Generate the base forms plus a few stripping passes; the caller resolves the
 * first candidate that exists locally.
 */
export function aaSlugCandidates(value: string): string[] {
  const base = value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  // Letter-prefixed version groups: qwen3-8-max → qwen3.8-max (base slug is
  // always tried first, so this only fills naming differences).
  const letterDot = (s: string) => s.replace(/([a-z])(\d+)-(\d+)(?=-|$)/g, '$1$2.$3');
  const candidates = new Set([base]);
  candidates.add(base.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2'));
  candidates.add(letterDot(base));
  const suffixes = [
    /-reasoning$/, /-non-reasoning$/, /-thinking$/, /-preview$/, /-latest$/,
    /-(?:xhigh|high|medium|minimal|low)$/, // AA effort tags (base slug is tried first)
    /-\d{8}$/, /-\d{4}-\d{2}-\d{2}$/,
  ];
  for (let pass = 0; pass < 3; pass += 1) {
    for (const candidate of [...candidates]) {
      for (const suffix of suffixes) {
        const stripped = candidate.replace(suffix, '');
        if (stripped) candidates.add(stripped);
      }
      candidates.add(candidate.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2'));
      candidates.add(letterDot(candidate));
    }
  }
  return [...candidates];
}

/**
 * Resolve an AA leaderboard row to one local model id.
 *
 * `explicitAliases` handles source codenames no normalization can recover
 * (e.g. vega-alpha → gpt-6-astra). Returns undefined when nothing matches;
 * AA leaderboards legitimately evaluate models we do not price.
 */
export function resolveLocalModelId(
  aaSlug: string,
  bySlug: ReadonlyMap<string, { id: number }>,
  explicitAliases?: ReadonlyMap<string, string>,
): { id: number; slug: string } | undefined {
  const alias = explicitAliases?.get(aaSlug);
  const candidates = alias ? [alias, ...aaSlugCandidates(aaSlug)] : aaSlugCandidates(aaSlug);
  for (const candidate of candidates) {
    const model = bySlug.get(candidate);
    if (model) return { id: model.id, slug: candidate };
  }
  return undefined;
}
