/**
 * models.dev reference catalog (https://models.dev, github.com/sst/models.dev, MIT).
 *
 * Read-only external price reference used by audit-data.ts C19. This module
 * never writes to the database: models.dev is a community-PR-curated database,
 * so its role is an independent cross-check against our own scrapers, not a
 * source of truth. Its prices are always USD per 1M tokens, so our rows must
 * be currency-normalized before comparison (see toUSD in audit-data.ts).
 *
 * api.json shape (generated from TOML at build time):
 *   { [providerKey]: { name, doc, models: Array<{key, value: Model}> | Record<id, Model> } }
 * Model cost: { input, output, cache_read, cache_write } per 1M tokens, USD.
 */

const MODELSDEV_API = process.env.MODELSDEV_API_URL ?? 'https://models.dev/api.json';
const DEFAULT_TIMEOUT_MS = 20_000;

export interface ModelsDevCost {
  input?: number | null;
  output?: number | null;
  cache_read?: number | null;
  cache_write?: number | null;
}

export interface ModelsDevModel {
  id: string;
  name?: string;
  cost?: ModelsDevCost | null;
  status?: string | null;
  last_updated?: string | null;
}

interface ModelsDevProvider {
  name?: string;
  doc?: string | null;
  models:
    | Array<{ key: string; value: ModelsDevModel }>
    | Record<string, ModelsDevModel>;
}

export type ModelsDevApiJson = Record<string, ModelsDevProvider>;

export interface ModelsDevRefPrice {
  /** Canonicalized id this price was filed under (same key across variants). */
  key: string;
  /** Original models.dev id, for finding output. */
  rawId: string;
  input: number;
  output: number;
  lastUpdated: string | null;
}

export interface ModelsDevLookup {
  mdProvider: string;
  key: string;
  /** Every variant canonicalizing to the same id (snapshots/regions); prices may differ. */
  candidates: ModelsDevRefPrice[];
}

interface ProviderProfile {
  /** Provider key in models.dev api.json. */
  mdKey: string;
  /** true when our prices for this provider are stored in a non-USD currency. */
  fxConverted: boolean;
}

/**
 * Our provider slugs → models.dev provider keys. Providers missing here are
 * intentionally not cross-checked:
 *  - dmxapi / xiurouter: Chinese resellers, absent from models.dev
 *  - zhipu-china: models.dev only carries z.ai's global USD price list, which
 *    is a genuinely different price list from bigmodel.cn CNY pricing
 *  - baidu: ERNIE went free, no token prices upstream
 *  - hunyuan / siliconflow / replicate / anyscale / dmxapi: no matching
 *    models.dev provider (or no available rows of our own to compare)
 */
const PROVIDER_PROFILES: Record<string, ProviderProfile> = {
  openai: { mdKey: 'openai', fxConverted: false },
  anthropic: { mdKey: 'anthropic', fxConverted: false },
  google: { mdKey: 'google', fxConverted: false },
  deepseek: { mdKey: 'deepseek', fxConverted: false },
  grok: { mdKey: 'xai', fxConverted: false },
  mistral: { mdKey: 'mistral', fxConverted: false },
  stepfun: { mdKey: 'stepfun', fxConverted: true },
  qwen: { mdKey: 'alibaba-cn', fxConverted: true },
  seed: { mdKey: 'volcengine', fxConverted: true },
  'moonshot-china': { mdKey: 'moonshotai-cn', fxConverted: true },
  'minimax-china': { mdKey: 'minimax-cn', fxConverted: true },
  'aws-bedrock': { mdKey: 'amazon-bedrock', fxConverted: false },
  'vertex-ai': { mdKey: 'google-vertex', fxConverted: false },
  'azure-openai': { mdKey: 'azure', fxConverted: false },
  'together-ai': { mdKey: 'togetherai', fxConverted: false },
  fireworks: { mdKey: 'fireworks-ai', fxConverted: false },
  openrouter: { mdKey: 'openrouter', fxConverted: false },
};

/**
 * Canonicalize a model id/slug so our base-model slugs line up with
 * models.dev's per-provider API ids. The conventions differ on both sides:
 *  - ours: `claude-opus-4.6`, `deepseek-v4-pro(2)`, `doubao-seed-2.1-pro`
 *  - md:   `claude-opus-4-6`, `deepseek-v4-pro`, `doubao-seed-2-1-pro-260628`
 *    plus path/region/version/snapshot prefixes and suffixes specific to each
 *    cloud provider.
 */
export function canonicalModelKey(rawId: string, opts: { fireworksDotP?: boolean } = {}): string {
  let s = rawId.toLowerCase().trim();

  // Our DB carries parenthesized disambiguation suffixes: deepseek-v4-pro(2).
  s = s.replace(/[（(]\d+[)）]$/, '');

  // Bedrock: region prefix (us./eu./au./jp./global./ap-northeast-1.) then the
  // vendor namespace (anthropic./amazon./meta./...), possibly both.
  s = s.replace(/^(?:us|eu|au|jp|apac?|global|ap-[a-z]+-\d+)\./, '');
  s = s.replace(/^(?:anthropic|amazon|meta|cohere|mistralai?|deepseek|qwen)\./, '');

  // Vertex: `claude-opus-4-6@default` / `@20250912`. Bedrock: trailing `:0`.
  s = s.replace(/@.*$/, '').replace(/:\d+$/, '');

  // Vendor path prefixes: openrouter `anthropic/claude-opus-5`, fireworks
  // `accounts/fireworks/models/glm-5p2`, together `Qwen/Qwen3-...`.
  s = s.split('/').pop() ?? s;

  // Fireworks renders a point version as p: glm-5p2 / kimi-k2p6 → glm-5.2.
  if (opts.fireworksDotP) s = s.replace(/(\d)p(?=\d)/g, '$1-');

  s = s.replace(/[._]/g, '-');

  // Date/snapshot tokens: 8-digit 20251001, 6-digit YYMMDD (260628), and
  // standalone MMDD mid-id (grok-4.20-0309-reasoning).
  s = s.replace(/(?<=^|-)(?:20\d{6}|(?:2[4-9]|3[01])\d{4})(?=-|$)/g, '');
  s = s.replace(/(?<=^|-)(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?=-|$)/g, '');

  // Together abbreviates throughput as tput; our slug spells it out.
  s = s.replace(/(?<=^|-)tput(?=-|$)/g, 'throughput');

  // Repeatedly peel trailing release qualifiers.
  for (;;) {
    const next = s
      .replace(/(?:^|-)(?:v\d+|latest|ga|preview|exp|exp\d*)$/, '')
      .replace(/-+$/g, '');
    if (next === s) break;
    s = next;
  }

  return s.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function ourModelKey(ourProviderSlug: string, ourModelSlug: string): string {
  return canonicalModelKey(ourModelSlug, { fireworksDotP: ourProviderSlug === 'fireworks' });
}

/** Rows our scrapers materialize as separate -batch entries have no md counterpart. */
export function isModelsDevComparable(ourProviderSlug: string, ourModelSlug: string): boolean {
  if (!(ourProviderSlug in PROVIDER_PROFILES)) return false;
  if (/-batch$/.test(ourModelSlug)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Coding-plan entitlement providers (zero-priced pseudo-providers in api.json
// that list the models a subscription plan can call)
// ---------------------------------------------------------------------------

/** (our plan provider slug, plan slug) → models.dev coding-plan provider key. */
const PLAN_PROVIDER_MAP: Array<{ provider: string; plan?: RegExp; mdKey: string }> = [
  { provider: 'zhipu-china', plan: /^glm-coding-/, mdKey: 'zhipuai-coding-plan' },
  { provider: 'zhipu-global', plan: /^z-ai-/, mdKey: 'zai-coding-plan' },
  { provider: 'qwen', plan: /^aliyun-bailian-coding-pro$/, mdKey: 'alibaba-coding-plan-cn' },
  { provider: 'seed', plan: /^seed-(free-trial|lite|pro|enterprise)$/, mdKey: 'volcengine-coding-plan' },
  // minimax-token-* are Agent/Token plans, not the MiniMax Coding Plan
  // subscription md lists — different products, so they are intentionally unmapped.
];

/**
 * Coding-plan entitlement check policy. GLM Coding Plans are deliberately
 * pinned to glm-5.3/glm-5.3-flash (only_extra): per docs.bigmodel.cn the older
 * accepted model names are server-rerouted, while models.dev lists every
 * accepted alias. That convention difference is verified, not drift.
 */
export const PLAN_DRIFT_SKIP = new Set<string>([
  'zhipu-china/glm-coding-lite',
  'zhipu-china/glm-coding-pro',
  'zhipu-china/glm-coding-max',
  'zhipu-global/z-ai-lite',
  'zhipu-global/z-ai-pro',
  'zhipu-global/z-ai-max',
]);

export interface ModelsDevPlanModels {
  mdProvider: string;
  /** Canonicalized ids, aligned to our slug conventions (lowercase, etc.). */
  ids: string[];
}

/**
 * Normalize a coding-plan model id toward our catalog slug shape for set
 * comparison: lowercase, dots/underscores to hyphens, drop vendor path
 * prefixes and dated snapshot suffixes (qwen3-max-2026-01-23 → qwen3-max).
 */
export function planModelSlug(rawId: string): string {
  // Keep dots: our catalog uses them (minimax-m2.5, doubao-seed-2.0-lite).
  return rawId
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/^[a-z0-9-]+\//, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

export class ModelsDevCatalog {
  readonly providerCount: number;
  readonly pricedEntryCount: number;

  constructor(
    private readonly byMdProvider: Map<string, Map<string, ModelsDevRefPrice[]>>,
    private readonly rawProviders: Map<string, ModelsDevProvider>,
    providerCount: number,
    pricedEntryCount: number,
  ) {
    this.providerCount = providerCount;
    this.pricedEntryCount = pricedEntryCount;
  }

  static fromJson(data: ModelsDevApiJson): ModelsDevCatalog {
    const byMdProvider = new Map<string, Map<string, ModelsDevRefPrice[]>>();
    const rawProviders = new Map<string, ModelsDevProvider>();
    let priced = 0;

    for (const [mdProvider, provider] of Object.entries(data)) {
      rawProviders.set(mdProvider, provider);
      const rawModels: ModelsDevModel[] = Array.isArray(provider.models)
        ? provider.models.map(m => ({ ...m.value, id: m.value.id ?? m.key }))
        : Object.entries(provider.models ?? {}).map(([key, value]) => ({ ...value, id: value.id ?? key }));

      const byKey = new Map<string, ModelsDevRefPrice[]>();
      for (const m of rawModels) {
        const cost = m.cost;
        if (!cost || typeof cost.input !== 'number' || typeof cost.output !== 'number') continue;
        if (cost.input < 0 || cost.output < 0) continue;
        // Free tiers (coding-plan providers, promo models) cannot validate paid rows.
        if (cost.input === 0 && cost.output === 0) continue;
        if (m.status === 'deprecated') continue;
        // OpenRouter "~vendor/model-latest" ids are auto-routing endpoints
        // whose model behind the alias changes; canonicalization would also
        // collapse glm-latest onto the bare glm family and create false hits.
        if (m.id.startsWith('~')) continue;
        priced++;

        const key = canonicalModelKey(m.id, { fireworksDotP: mdProvider === 'fireworks-ai' });
        if (!key) continue;
        const list = byKey.get(key) ?? [];
        list.push({
          key,
          rawId: m.id,
          input: cost.input,
          output: cost.output,
          lastUpdated: m.last_updated ?? null,
        });
        byKey.set(key, list);
      }
      byMdProvider.set(mdProvider, byKey);
    }

    return new ModelsDevCatalog(byMdProvider, rawProviders, Object.keys(data).length, priced);
  }

  profileFor(ourProviderSlug: string): ProviderProfile | undefined {
    return PROVIDER_PROFILES[ourProviderSlug];
  }

  isFxConverted(ourProviderSlug: string): boolean {
    return PROVIDER_PROFILES[ourProviderSlug]?.fxConverted ?? false;
  }

  /** Find the models.dev coding-plan provider for one of our plans, if mapped. */
  planProviderFor(ourProviderSlug: string, ourPlanSlug: string): string | null {
    const hit = PLAN_PROVIDER_MAP.find(
      m => m.provider === ourProviderSlug && (m.plan ? m.plan.test(ourPlanSlug) : true),
    );
    return hit?.mdKey ?? null;
  }

  /** Entitlement model ids of a coding-plan pseudo-provider (priced at zero). */
  planModels(mdProviderKey: string): ModelsDevPlanModels | null {
    const provider = this.rawProviders.get(mdProviderKey);
    if (!provider) return null;
    const rawModels: ModelsDevModel[] = Array.isArray(provider.models)
      ? provider.models.map(m => ({ ...m.value, id: m.value.id ?? m.key }))
      : Object.entries(provider.models ?? {}).map(([key, value]) => ({ ...value, id: value.id ?? key }));
    const ids = [...new Set(rawModels.map(m => planModelSlug(m.id)).filter(Boolean))].sort();
    return { mdProvider: mdProviderKey, ids };
  }

  /** Token-priced model slugs of a regular provider (excludes free/zero rows). */
  providerModelSlugs(mdProviderKey: string): string[] {
    const map = this.byMdProvider.get(mdProviderKey);
    return map ? [...map.keys()].sort() : [];
  }

  /** Whether md lists a (token-priced, non-free) model under that provider. */
  providerHasModel(mdProviderKey: string, canonicalKey: string): boolean {
    return this.byMdProvider.get(mdProviderKey)?.has(canonicalKey) ?? false;
  }

  lookup(ourProviderSlug: string, ourModelSlug: string): ModelsDevLookup | null {
    const profile = PROVIDER_PROFILES[ourProviderSlug];
    if (!profile) return null;
    const byKey = this.byMdProvider.get(profile.mdKey);
    if (!byKey) return null;
    const key = ourModelKey(ourProviderSlug, ourModelSlug);
    const candidates = byKey.get(key);
    if (!candidates || candidates.length === 0) return null;
    return { mdProvider: profile.mdKey, key, candidates };
  }
}

export async function fetchModelsDevCatalog(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ModelsDevCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(MODELSDEV_API, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = (await res.json()) as ModelsDevApiJson;
    return ModelsDevCatalog.fromJson(json);
  } finally {
    clearTimeout(timer);
  }
}

// CLI self-test: npx tsx scripts/scrapers/modelsdev.ts
if (require.main === module) {
  const samples: Array<[string, string]> = [
    ['anthropic', 'claude-opus-4.6'],
    ['anthropic', 'claude-haiku-4-5'],
    ['openai', 'gpt-5.3-codex'],
    ['openai', 'gpt-5.6-luna'],
    ['google', 'gemini-3-flash'],
    ['grok', 'grok-4.5'],
    ['deepseek', 'deepseek-v4-pro(2)'],
    ['qwen', 'qwen-max'],
    ['seed', 'doubao-seed-2.1-pro'],
    ['azure-openai', 'gpt-5.2'],
    ['aws-bedrock', 'claude-3.5-sonnet'],
    ['vertex-ai', 'gemini-2.5-pro'],
    ['together-ai', 'qwen3-235b-a22b-instruct-2507-fp8-throughput'],
    ['fireworks', 'glm-5.2'],
    ['openrouter', 'claude-opus-5'],
    ['moonshot-china', 'kimi-k2.7-code-highspeed'],
    ['minimax-china', 'minimax-m2.7'],
    ['stepfun', 'step-3.7-flash'],
  ];

  fetchModelsDevCatalog().then(catalog => {
    console.log(`\nmodels.dev: ${catalog.providerCount} providers, ${catalog.pricedEntryCount} priced entries\n`);
    for (const [provider, slug] of samples) {
      const hit = catalog.lookup(provider, slug);
      if (!hit) {
        console.log(`✗ ${provider}/${slug}  (key=${ourModelKey(provider, slug)}) — no match`);
        continue;
      }
      const price = hit.candidates[0];
      const more = hit.candidates.length > 1 ? `  (+${hit.candidates.length - 1} variants)` : '';
      console.log(
        `✓ ${provider}/${slug} → ${hit.mdProvider}/${price.rawId}  $${price.input}/$${price.output}${more}`,
      );
    }
  }).catch(e => {
    console.error('models.dev fetch failed:', e);
    process.exit(1);
  });
}
