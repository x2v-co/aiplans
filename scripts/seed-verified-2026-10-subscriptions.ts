#!/usr/bin/env tsx
/**
 * Seed The X Subscription tiers (including Cursor), Muse Code tiers and
 * muse-wonder-1.0 API price,
 * and mark legacy SuperGrok / X Premium / Cursor plans closed to new users
 * (kept, not deleted). Dry-run by default; --apply writes.
 */
import { db } from './db/queries';
import {
  MUSE_CODE_PLANS, MUSE_WONDER_MODEL,
  VERIFIED_AT_ISO, X_SUBSCRIPTION_PLANS, type SubscriptionSeed,
} from './data/verified-2026-10-subscriptions';
import { markLegacyPlans } from './data/mark-legacy-plans';
import { subscriptionPlanRow } from './data/subscription-plan-row';

const APPLY = process.argv.includes('--apply');
const NOW = new Date();
const VERIFIED_AT = new Date(VERIFIED_AT_ISO);
const META_SLUGS = ['meta', 'meta-ai', 'meta-llama'];

interface ProviderRow { id: number; slug: string; name: string }
let failures = 0;

async function loadProviders(): Promise<Map<string, ProviderRow>> {
  const { data, error } = await db.from('providers').select('id, slug, name');
  if (error) throw error;
  return new Map<string, ProviderRow>((data ?? []).map((p: ProviderRow) => [p.slug, p]));
}

async function ensureMetaProvider(providers: Map<string, ProviderRow>): Promise<ProviderRow | null> {
  for (const slug of META_SLUGS) { const p = providers.get(slug); if (p) return p; }
  console.log('  ➕ provider meta (Meta Model API)');
  if (!APPLY) return { id: -1, slug: 'meta', name: 'Meta' };
  const { data, error } = await db.from('providers').insert({
    name: 'Meta', slug: 'meta', website: 'https://dev.meta.ai', pricing_url: 'https://dev.meta.ai/docs/overview',
    region: 'global', type: 'official', access_from_china: false,
  }).select('id, slug, name').single();
  if (error) throw error;
  return data as ProviderRow;
}

async function ensureModel(provider: ProviderRow): Promise<number> {
  const m = MUSE_WONDER_MODEL;
  const row = {
    name: m.name, slug: m.slug, type: 'llm', model_category: 'text', context_window: m.contextWindow,
    open_source: m.openSource, offical_link: 'https://research.meta.ai/blog/muse-wonder',
    input_modalities: ['text', 'image', 'video', 'audio'], output_modalities: ['text'],
    released_at: m.releasedAt, updated_at: NOW,
    ...(provider.id > 0 ? { provider_ids: [provider.id] } : {}),
  };
  const existing = await db.from('models').select('id').eq('slug', m.slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    console.log(`  ↻ model ${m.slug} (ctx ${m.contextWindow})`);
    if (APPLY) { const { error } = await db.from('models').update({ context_window: m.contextWindow, updated_at: NOW }).eq('id', existing.data.id); if (error) throw error; }
    return existing.data.id;
  }
  console.log(`  ➕ model ${m.slug} (ctx ${m.contextWindow})`);
  if (!APPLY) return -1;
  const { data, error } = await db.from('models').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertApiPrice(modelId: number, provider: ProviderRow) {
  const m = MUSE_WONDER_MODEL;
  console.log(`  ${modelId < 0 ? '➕' : '↻'} api price ${provider.slug}/${m.apiModelId}: in $${m.inputPricePer1m} / cached $${m.cachedInputPricePer1m} / out $${m.outputPricePer1m} per 1M`);
  if (!APPLY) return;
  const row = {
    model_id: modelId, provider_id: provider.id, input_price_per_1m: m.inputPricePer1m,
    cached_input_price_per_1m: m.cachedInputPricePer1m, output_price_per_1m: m.outputPricePer1m,
    currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, notes: m.notes,
    last_verified: VERIFIED_AT, updated_at: NOW,
  };
  const existing = await db.from('api_channel_prices').select('id').eq('model_id', modelId).eq('provider_id', provider.id).maybeSingle();
  if (existing.error) throw existing.error;
  const { error } = existing.data
    ? await db.from('api_channel_prices').update(row).eq('id', existing.data.id)
    : await db.from('api_channel_prices').insert(row);
  if (error) throw error;
}

async function upsertPlan(seed: SubscriptionSeed, provider: ProviderRow): Promise<number> {
  const existing = provider.id < 0 ? { data: null, error: null } : await db.from('plans').select('id').eq('provider_id', provider.id).eq('slug', seed.slug).maybeSingle();
  if (existing.error) throw existing.error;
  console.log(`  ${existing.data ? '↻' : '➕'} plan ${provider.slug}/${seed.slug}: ${seed.price == null ? 'price unknown' : `${seed.currency} ${seed.price}/mo`}`);
  if (!APPLY) return existing.data?.id ?? -1;
  const row = subscriptionPlanRow(seed, provider.id, NOW);
  if (existing.data) { const { error } = await db.from('plans').update(row).eq('id', existing.data.id); if (error) throw error; return existing.data.id; }
  const { data, error } = await db.from('plans').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function mapModel(modelId: number, planId: number, label: string) {
  if (modelId < 0 || planId < 0) { console.log(`    ↳ map ${label}`); return; }
  const existing = await db.from('model_plan_mapping').select('id').eq('model_id', modelId).eq('plan_id', planId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;
  console.log(`    ↳ map ${label}`);
  if (APPLY) { const { error } = await db.from('model_plan_mapping').insert({ model_id: modelId, plan_id: planId, priority: 20, source: 'manual' }); if (error) throw error; }
}

async function markLegacy(providers: Map<string, ProviderRow>) {
  await markLegacyPlans(db, providers, { apply: APPLY, now: NOW });
}

async function main() {
  console.log(`\n💵 seed-verified-2026-10-subscriptions ${APPLY ? '[APPLY]' : '[DRY-RUN]'}\n`);
  const providers = await loadProviders();
  const xai = providers.get('xai');
  if (!xai) { console.log('  ⚠ missing provider xai'); failures++; }
  else for (const seed of X_SUBSCRIPTION_PLANS) await upsertPlan(seed, xai);
  await markLegacy(providers);

  const meta = await ensureMetaProvider(providers);
  if (meta) {
    const modelId = await ensureModel(meta);
    await upsertApiPrice(modelId, meta);
    for (const seed of MUSE_CODE_PLANS) { const planId = await upsertPlan(seed, meta); await mapModel(modelId, planId, `muse-wonder → ${seed.slug}`); }
  }
  if (!APPLY) console.log('\nDry-run only. Re-run with --apply to write.');
  if (failures) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
