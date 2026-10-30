/** Pure, DB-free change planner. Its output is the exact input to the writer. */
import { CLASSIFICATIONS } from '../config/plan-classifications';
import { canonicalJson } from '../config/canonical-json';
import { resolveSelector, type ModelSelector } from '../../src/lib/plan-selector';
import {
  VERIFIED_275, MINIMAX_FLASH, MINIMAX_FLASH_ALIASES, MINIMAX_SOURCE_275,
  MINIMAX_CN_SOURCE_275, KIMI_SOURCE_275, KIMI_HIGHSPEED, KIMI_PRO,
  KIMI_TIERS_275, KIMI_LEGACY_MARKER, KIMI_LEGACY_SELECTOR, KIMI_PRICE_CAVEAT, kimiSelector275,
} from './minimax-flash-kimi-tiers';

export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export type Row275 = Record<string, Value | undefined>;
export const TABLES_275 = [
  'providers', 'models', 'plans', 'api_channel_prices', 'price_history',
  'api_channel_price_variants', 'usage_prices', 'model_plan_mapping', 'model_offical',
  'model_benchmark_scores', 'evaluation_run', 'coding_agent_scores',
  'external_price_references', 'model_slug_redirects',
] as const;
export type Table275 = typeof TABLES_275[number];
export type Snapshot275 = Record<Table275, Row275[]>;
export type Step275 = {
  action: 'insert' | 'update' | 'delete'; table: Table275; key: Row275;
  before: Row275 | null; values: Row275; source_url: string; last_verified: string;
};
export const MINIMAX_PLANS_275 = CLASSIFICATIONS.filter(c =>
  ['minimax-china', 'minimax-global'].includes(c.providerSlug));

export function emptySnapshot275(): Snapshot275 {
  return TABLES_275.reduce((snapshot, table) => { snapshot[table] = []; return snapshot; }, {} as Snapshot275);
}
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);
const note275 = (url: string) => `[aiplans:issue-275 source_url=${url} last_verified=${VERIFIED_275}]`;
const append = (text: Value | undefined, line: string) => String(text ?? '').includes(line)
  ? String(text) : [text, line].filter(Boolean).join('\n');

/** Monthly figures conflict with the official annual-equivalent label; default to verified basis. */
export function planRepair275(input: Snapshot275, priceBasis: 'annual-equivalent' | 'issue-monthly' = 'annual-equivalent') {
  const state: Snapshot275 = JSON.parse(JSON.stringify(input));
  for (const table of TABLES_275) if (!Array.isArray(state[table])) throw new Error(`Missing snapshot table ${table}`);
  const steps: Step275[] = [];
  let temporaryId = -1;
  const emit = (table: Table275, row: Row275 | null, values: Row275, url = MINIMAX_SOURCE_275, remove = false): Row275 => {
    if (row && !remove && Object.entries(values).every(([k, v]) => equal(row[k] ?? null, v ?? null))) return row;
    const key = table === 'model_slug_redirects' ? { old_slug: (row ?? values).old_slug } : { id: row?.id ?? temporaryId-- };
    const action = remove ? 'delete' : row ? 'update' : 'insert';
    steps.push({ table, action, key, before: row ? { ...row } : null, values, source_url: url, last_verified: VERIFIED_275 });
    if (remove) { state[table].splice(state[table].indexOf(row!), 1); return row!; }
    if (row) { Object.assign(row, values); return row; }
    const added = { ...key, ...values }; state[table].push(added); return added;
  };
  const one = (table: Table275, predicate: (r: Row275) => boolean, label: string, required = true) => {
    const rows = state[table].filter(predicate);
    if (rows.length > 1 || (required && !rows.length)) throw new Error(`${label}: expected ${required ? 'one' : 'at most one'} row, found ${rows.length}`);
    return rows[0];
  };
  const provider = (slug: string) => one('providers', r => r.slug === slug, `provider ${slug}`);
  const cn = provider('minimax-china'), global = provider('minimax-global'), kimi = provider('moonshot-china');
  const candidates = state.models.filter(r => [MINIMAX_FLASH, ...MINIMAX_FLASH_ALIASES].includes(String(r.slug)));
  if (!candidates.length) throw new Error('No MiniMax Flash model found; refusing to invent model metadata');
  const target = candidates.find(r => r.slug === MINIMAX_FLASH)
    ?? candidates.find(r => r.slug === 'minimax-m3.1') ?? candidates[0];
  const providerIds = [...new Set([...candidates.flatMap(r => (r.provider_ids ?? []) as Value[]), cn.id!, global.id!])];

  // Same conflict policy as the existing Gemini merge SQL, including channel history.
  const mergeKeys: Partial<Record<Table275, string[]>> = {
    api_channel_prices: ['provider_id'], api_channel_price_variants: ['provider_id', 'variant_key'],
    model_plan_mapping: ['plan_id'], model_offical: ['producer_id'],
    model_benchmark_scores: ['benchmark_task_id', 'metric_id', 'release_date'],
    usage_prices: ['provider_id', 'plan_id', 'price_kind', 'unit', 'currency', 'constraints_json', 'price', 'is_available'],
  };
  for (const old of candidates.filter(r => r !== target)) {
    for (const table of TABLES_275.filter(t => !['providers', 'models', 'plans', 'price_history'].includes(t))) {
      for (const row of [...state[table]].filter(r => sameId(r.model_id, old.id))) {
        const keys = mergeKeys[table];
        const conflict = keys && state[table].find(r => sameId(r.model_id, target.id)
          && keys.every(k => equal(r[k] ?? null, row[k] ?? null)));
        if (conflict) {
          if (table === 'api_channel_prices') {
            for (const h of state.price_history.filter(h => sameId(h.channel_price_id, row.id))) emit('price_history', h, { channel_price_id: conflict.id });
          }
          // A manually curated association must survive a collision with a derived one.
          if (table === 'model_plan_mapping' && row.source === 'manual') emit(table, conflict, { source: 'manual' });
          emit(table, row, {}, MINIMAX_SOURCE_275, true);
        } else {
          const values: Row275 = { model_id: target.id };
          if (table === 'api_channel_price_variants' && row.is_headline && row.is_available
            && state[table].some(r => sameId(r.model_id, target.id) && sameId(r.provider_id, row.provider_id) && r.is_headline && r.is_available)) values.is_headline = false;
          emit(table, row, values);
        }
      }
    }
    emit('models', old, {}, MINIMAX_SOURCE_275, true);
  }
  emit('models', target, {
    slug: MINIMAX_FLASH, name: 'MiniMax-M3.1-Flash', provider_ids: providerIds,
    offical_link: MINIMAX_SOURCE_275,
  });
  for (const slug of MINIMAX_FLASH_ALIASES) {
    const alias = one('model_slug_redirects', r => r.old_slug === slug, `alias ${slug}`, false);
    if (alias && !sameId(alias.model_id, target.id)) throw new Error(`Alias ${slug} points at an unrelated model`);
    emit('model_slug_redirects', alias ?? null, { old_slug: slug, model_id: target.id, reason: note275(MINIMAX_SOURCE_275) });
  }
  // Rewrite explicit selector references throughout the catalog, including bundles.
  for (const plan of state.plans) {
    const selector = plan.model_selector as unknown as ModelSelector | null;
    if (!selector) continue;
    const replace = (slugs?: string[]) => slugs && [...new Set(slugs.map(s => MINIMAX_FLASH_ALIASES.includes(s) ? MINIMAX_FLASH : s))];
    const rewritten = { ...selector, ...(selector.extra ? { extra: replace(selector.extra) } : {}),
      ...(selector.exclude ? { exclude: replace(selector.exclude) } : {}) };
    if (!equal(selector, rewritten)) emit('plans', plan, { model_selector: rewritten as Value });
  }
  for (const [p, currency, input, cached, output, url] of [
    [cn, 'CNY', 1, 0.1, 4, MINIMAX_CN_SOURCE_275],
    [global, 'USD', 0.15, 0.015, 0.6, MINIMAX_SOURCE_275],
  ] as const) {
    const channel = one('api_channel_prices', r => sameId(r.model_id, target.id) && sameId(r.provider_id, p.id), `Flash channel ${p.slug}`, false);
    emit('api_channel_prices', channel ?? null, {
      model_id: target.id, provider_id: p.id, currency, input_price_per_1m: input,
      cached_input_price_per_1m: cached, output_price_per_1m: output, price_unit: 'per_1m_tokens',
      is_available: true, notes: append(channel?.notes, note275(url)), last_verified: VERIFIED_275,
    }, url);
    // Existing unqualified usage rates must agree; preserve context/plan-specific rates.
    for (const row of state.usage_prices.filter(r => sameId(r.model_id, target.id) && sameId(r.provider_id, p.id)
      && r.plan_id == null && ['per_1m_tokens', '1M_tokens'].includes(String(r.unit))
      && (r.constraints_json == null || equal(r.constraints_json, {})))) {
      const rate = { input_tokens: input, output_tokens: output, cached_input_tokens: cached }[String(row.price_kind)];
      if (rate != null) emit('usage_prices', row, { currency, price: rate, source_url: url, last_verified: VERIFIED_275 }, url);
    }
  }

  // Corrections above can make two formerly different usage prices identical.
  const usageKeys = mergeKeys.usage_prices!;
  const seenUsage = new Map<string, Row275>();
  for (const row of [...state.usage_prices].filter(r => sameId(r.model_id, target.id)).sort((a, b) => Number(a.id) - Number(b.id))) {
    const key = canonicalJson(usageKeys.map(k => row[k] ?? null));
    if (seenUsage.has(key)) emit('usage_prices', row, {}, MINIMAX_SOURCE_275, true);
    else seenUsage.set(key, row);
  }

  // Preserve April Free/Pro rows, including all of their historical foreign keys.
  for (const slug of ['kimi-free', 'kimi-pro']) {
    const old = one('plans', r => sameId(r.provider_id, kimi.id) && r.slug === slug, slug, false);
    if (old && old.plan_line !== 'kimi' && !String(old.notes ?? '').includes('[aiplans:issue-275')) {
      const legacySlug = `${slug}-legacy-2026-04`;
      if (state.plans.some(r => sameId(r.provider_id, kimi.id) && r.slug === legacySlug)) throw new Error(`Both ${slug} and ${legacySlug} exist without a repair marker`);
      emit('plans', old, { slug: legacySlug }, KIMI_SOURCE_275);
    } else if (old && !String(old.notes ?? '').includes('[aiplans:issue-275')) {
      // April rows may already have plan_line=kimi from fix-plan-kinds.
      if ((slug === 'kimi-pro' && old.price === 99) || slug === 'kimi-free') {
        const legacySlug = `${slug}-legacy-2026-04`;
        if (state.plans.some(r => sameId(r.provider_id, kimi.id) && r.slug === legacySlug)) throw new Error(`Ambiguous legacy ${slug}`);
        emit('plans', old, { slug: legacySlug }, KIMI_SOURCE_275);
      } else throw new Error(`Unrecognized unmarked ${slug}; verify before replacing`);
    }
  }
  const legacySlugs = ['kimi-free-legacy-2026-04', 'kimi-basic', 'kimi-pro-legacy-2026-04', 'kimi-team', 'kimi-enterprise'];
  for (const row of state.plans.filter(r => sameId(r.provider_id, kimi.id) && legacySlugs.includes(String(r.slug)))) {
    emit('plans', row, { notes: append(append(row.notes, KIMI_LEGACY_MARKER), note275(KIMI_SOURCE_275)),
      plan_line: 'kimi-legacy', source: 'manual', model_selector: KIMI_LEGACY_SELECTOR as Value,
      third_party_coverage: 'none', last_verified: VERIFIED_275 }, KIMI_SOURCE_275);
  }
  one('models', r => r.slug === KIMI_PRO, KIMI_PRO);
  const highspeed = one('models', r => r.slug === KIMI_HIGHSPEED, KIMI_HIGHSPEED);
  const allowed = new Set<Value | undefined>();
  for (const [rank, seed] of KIMI_TIERS_275.entries()) {
    const slug = `kimi-${seed.tier}`;
    const existing = one('plans', r => sameId(r.provider_id, kimi.id) && r.slug === slug, slug, false);
    const notes = `${note275(KIMI_SOURCE_275)}\n${KIMI_PRICE_CAVEAT}${seed.tier === 'free' ? '\nK3.1 Pro: limited use on Kimi web/Kimi Work; numerical allowance unverified.' : ''}${priceBasis === 'issue-monthly' ? '\nMonthly price follows issue #275 user instruction; official article conflicts with this billing basis.' : ''}`;
    const plan = emit('plans', existing ?? null, {
      provider_id: kimi.id, product_id: kimi.id, slug, name: `Kimi ${seed.name}`, tier: seed.tier,
      price: seed.tier === 'free' || priceBasis === 'issue-monthly' ? seed.price : null,
      price_yearly_monthly: priceBasis === 'annual-equivalent' ? seed.price : null,
      annual_price: null, currency: 'CNY', price_unit: 'per_month', pricing_model: 'subscription',
      plan_kind: 'chat', plan_category: 'chatbot', plan_line: 'kimi', tier_rank: rank,
      billing_granularity: priceBasis === 'annual-equivalent' && seed.tier !== 'free' ? 'flat_yearly' : 'flat_monthly', source: 'manual', is_official: true, is_contact_sales: false,
      access_from_china: true, region: 'china', quotas: null, model_selector: kimiSelector275(seed.tier) as Value,
      third_party_coverage: 'none', notes, last_verified: VERIFIED_275,
    }, KIMI_SOURCE_275);
    if (['pro', 'max', 'ultra'].includes(seed.tier)) allowed.add(plan.id);
  }
  // Incorrect manual Highspeed links are also removed; materialization alone preserves them.
  for (const row of [...state.model_plan_mapping]) {
    if (sameId(row.model_id, highspeed.id) && state.plans.some(p => sameId(p.id, row.plan_id) && sameId(p.provider_id, kimi.id)) && !allowed.has(row.plan_id)) emit('model_plan_mapping', row, {}, KIMI_SOURCE_275, true);
  }

  const catalog = state.models.map(m => ({ id: Number(m.id), slug: String(m.slug),
    description: m.description as string | null,
    providerSlugs: state.providers.filter(p => ((m.provider_ids ?? []) as Value[]).some(id => sameId(id, p.id))).map(p => String(p.slug)), elo: null }));
  const scopedPlans: Array<{ row: Row275; selector: ModelSelector; provider: string; url: string }> = [];
  for (const c of MINIMAX_PLANS_275) {
    const p = provider(c.providerSlug);
    const row = one('plans', r => sameId(r.provider_id, p.id) && r.slug === c.planSlug, `${c.providerSlug}/${c.planSlug}`);
    emit('plans', row, { model_selector: c.selector as Value, source: 'manual',
      notes: append(row.notes, note275(MINIMAX_SOURCE_275)), last_verified: VERIFIED_275 });
    scopedPlans.push({ row, selector: c.selector, provider: c.providerSlug, url: MINIMAX_SOURCE_275 });
  }
  for (const row of state.plans.filter(r => sameId(r.provider_id, kimi.id) && (r.plan_line === 'kimi' || legacySlugs.includes(String(r.slug))))) scopedPlans.push({ row, selector: row.model_selector as unknown as ModelSelector, provider: 'moonshot-china', url: KIMI_SOURCE_275 });
  const drift = [];
  // Same resolver and manual/derived ownership as materialize-model-plan-mappings.ts.
  for (const { row, selector, provider: providerSlug, url } of scopedPlans) {
    const result = resolveSelector(selector, catalog, [providerSlug]);
    if (result.unknownExtra.length) throw new Error(`Unknown selector extras: ${result.unknownExtra.join(', ')}`);
    const desired = result.models.map(m => m.id);
    if (providerSlug.startsWith('minimax') && !desired.includes(Number(target.id))) throw new Error(`${row.slug} lost Flash`);
    const existing = state.model_plan_mapping.filter(m => sameId(m.plan_id, row.id));
    drift.push({ plan: `${providerSlug}/${row.slug}`, missing: desired.filter(id => !existing.some(m => sameId(m.model_id, id))), stale: existing.filter(m => m.source === 'derived' && !desired.includes(Number(m.model_id))).map(m => m.model_id) });
    for (const link of existing.filter(m => m.source === 'derived' && !desired.includes(Number(m.model_id)))) emit('model_plan_mapping', link, {}, url, true);
    const derivedIds = desired.filter(id => !existing.some(m => sameId(m.model_id, id) && m.source === 'manual'));
    derivedIds.forEach((id, priority) => {
      const link = state.model_plan_mapping.find(m => sameId(m.plan_id, row.id) && sameId(m.model_id, id));
      emit('model_plan_mapping', link ?? null, { plan_id: row.id, model_id: id, priority, source: 'derived' }, url);
    });
  }
  return { steps, after: state, drift, priceBasis, caveats: [KIMI_PRICE_CAVEAT, 'Absolute token/message/request quotas and annual totals are not populated.'] };
}

/** Illustrative issue state, never a production dump. IDs have no external meaning. */
export function exampleSnapshot275(): Snapshot275 {
  const s = emptySnapshot275();
  s.providers = [{ id: 1, slug: 'minimax-china' }, { id: 2, slug: 'minimax-global' }, { id: 3, slug: 'moonshot-china' }];
  s.models = [{ id: 1, slug: 'minimax-m3.1', name: 'MiniMax-M3.1', provider_ids: [1] },
    { id: 2, slug: 'minimax-minimax-m3-1-flash', provider_ids: [2] },
    { id: 3, slug: KIMI_PRO, provider_ids: [3] }, { id: 4, slug: KIMI_HIGHSPEED, provider_ids: [3] }];
  s.plans = MINIMAX_PLANS_275.map((c, i) => ({ id: i + 1, slug: c.planSlug, provider_id: c.providerSlug === 'minimax-china' ? 1 : 2 }));
  s.plans.push(...['free', 'basic', 'pro', 'team', 'enterprise'].map((tier, i) => ({ id: 20 + i, slug: `kimi-${tier}`, name: `Kimi ${tier}`, price: [0, 49, 99, 199, null][i], provider_id: 3 })));
  return s;
}
