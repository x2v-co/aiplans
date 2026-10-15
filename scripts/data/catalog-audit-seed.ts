import type { Sql } from 'postgres';
import { AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { openRouterProducerSlug } from '../scrapers/openrouter';
import { seedChanges } from './gemini-4-argon';
import { auditVerticalModelFields, isAuditOwnedVertical } from './catalog-audit-vertical';
import { AUDIT_TIMESTAMP, OPENROUTER_ADDITIONS, auditedModelSlug, auditedPrices,
  LEGACY_PRO_NOTE, MAX_API_CREDIT_NOTE, cleanLegacyFeatures } from './catalog-audit-2026-10-15';

type Row = Record<string, unknown> & { id: number };
type Table = 'providers' | 'models' | 'api_channel_prices' | 'usage_prices' | 'plans' | 'api_channel_price_variants';
export interface AuditStep { table: string; target: string; action: string; changes: Record<string, unknown> }

/** The caller supplies a single serializable transaction. Dry-run issues SELECT only. */
export async function seedCatalogAudit(tx: Sql, apply: boolean): Promise<AuditStep[]> {
  const tables: Table[] = ['providers', 'models', 'api_channel_prices', 'usage_prices', 'plans', 'api_channel_price_variants'];
  const rows = {} as Record<Table, Row[]>;
  for (const table of tables) rows[table] = await tx<Row[]>`SELECT * FROM ${tx(table)}`;
  const steps: AuditStep[] = [];
  let previewId = -1;
  const one = (table: Table, matches: Row[], target: string) => {
    if (matches.length > 1) throw new Error(`Ambiguous ${table}/${target}; transaction aborted.`);
    return matches[0] ?? null;
  };
  const save = async (table: Table, existing: Row | null, values: Record<string, unknown>, target: string) => {
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) return existing!;
    steps.push({ table, target, action: existing ? 'update' : 'insert', changes });
    const payload: Record<string, unknown> = { ...values, updated_at: new Date() };
    let id = existing?.id ?? previewId--;
    if (apply) {
      if (existing) await tx`UPDATE ${tx(table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
      else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        id = inserted.id;
      }
    }
    const result = { ...existing, ...payload, id };
    if (existing) Object.assign(existing, result);
    else rows[table].push(result);
    return result;
  };
  const provider = async (slug: string, name = slug) => {
    const existing = one('providers', rows.providers.filter(r => r.slug === slug), slug);
    return existing ?? save('providers', null, { slug, name, type: slug === 'openrouter' ? 'aggregator' : 'producer',
      region: null, access_from_china: null, notes: 'Identity from 2026-10-15 audit; other provider metadata needs verification.' }, slug);
  };
  const model = async (slug: string, name: string, producerId: number | null, category = 'text', extras: Record<string, unknown> = {}) => {
    const existing = one('models', rows.models.filter(r => r.slug === slug), slug);
    const ids = [...new Set([...(Array.isArray(existing?.provider_ids) ? existing.provider_ids as number[] : []), ...(producerId == null ? [] : [producerId])])];
    return save('models', existing, { slug, name, provider_ids: ids,
      // Keep an existing type (e.g. subq-snap llm row shared with the P0 SQL); defaults for new rows only.
      type: existing?.type ?? (category === 'text' || slug === 'subq-snap' ? 'llm' : 'multimodal'),
      model_category: category, ...extras }, slug);
  };
  const channel = async (modelId: number, providerId: number, input: number | null, output: number | null, notes: string) => {
    const existing = one('api_channel_prices', rows.api_channel_prices.filter(r => r.model_id === modelId && r.provider_id === providerId), `${modelId}/${providerId}`);
    // OpenRouter -1 / null list prices (jev-router, switchyard, …) are not payg-usable: keep the
    // row for catalog identity but mark unavailable. last_verified still records the audit check.
    const variable = input == null || output == null;
    return save('api_channel_prices', existing, { model_id: modelId, provider_id: providerId,
      input_price_per_1m: input, output_price_per_1m: output, currency: 'USD', price_unit: 'per_1m_tokens',
      is_available: !variable, notes, last_verified: AUDIT_TIMESTAMP }, `${modelId}/${providerId}`);
  };
  const or = await provider('openrouter', 'OpenRouter');
  for (const [id, input, output] of OPENROUTER_ADDITIONS) {
    const owner = await provider(openRouterProducerSlug(id));
    const slug = auditedModelSlug(id);
    const decision = id.startsWith('scaledown/') || id === 'typesafe/jev-router';
    const catalogItem = AI_VERTICAL_CATALOG.find(i => i.kind === 'decision-model' && i.slug === slug);
    const m = await model(slug, catalogItem?.name ?? (id === 'mistralai/mistral-large-4-0' ? 'Mistral Large 4' : id.split('/')[1].replace(':batch', ' (batch)')), owner.id, decision ? 'decision' : 'text',
      { offical_link: catalogItem?.url ?? `https://openrouter.ai/${id}` });
    const price = auditedPrices(input, output);
    await channel(m.id, or.id, price.input_price_per_1m, price.output_price_per_1m,
      `${price.notes} Source: https://openrouter.ai/${id}`);
    if (id === 'liquid/lfm-2.5-24b-a2b') {
      await channel(m.id, owner.id, 0.1, 1, 'Official $0.10/$1.00 per 1M input/output per audit A2 #7 (2026-10-15). Source: https://openrouter.ai/liquid/lfm-2.5-24b-a2b; official pricing URL needs verification.');
    }
  }
  // Restore the OLD identity without transferring its official/other channels.
  const mistral = await provider('mistral', 'Mistral');
  const old = await model('mistral-large', 'Mistral Large', mistral.id);
  await channel(old.id, or.id, 2, 6, 'Old Mistral Large: OpenRouter $2/$6 per 1M. Large 4 is a separate model. Audit 2026-10-15; https://openrouter.ai/mistralai/mistral-large');
  // Repoint endpoint variants whose provenance proves they belong to Large 4.
  const large4 = rows.models.find(r => r.slug === 'mistral-large-4')!;
  for (const v of rows.api_channel_price_variants.filter(r => r.provider_id === or.id && r.model_id === old.id)) {
    const provenance = JSON.stringify([v.source_url, v.raw_json]);
    // The route-level openrouter-auto row carries the model's default price; only move it when
    // that price is Large 4's (the old Large row is $2/$6 and its provenance can still list 4-0).
    const large4Channel = rows.api_channel_prices.find(r => r.model_id === large4.id && r.provider_id === or.id);
    const samePrice = (r: Row, c: Row | undefined) => !!c && Number(r.input_price_per_1m) === Number(c.input_price_per_1m) && Number(r.output_price_per_1m) === Number(c.output_price_per_1m);
    const belongsTo4 = provenance.includes('mistral-large-4-0') && (v.variant_key !== 'openrouter-auto' || samePrice(v, large4Channel));
    if (belongsTo4) {
      const conflict = rows.api_channel_price_variants.some(r => r.model_id === large4.id && r.provider_id === or.id && r.variant_key === v.variant_key);
      if (conflict) throw new Error(`Large 4 variant conflict ${v.variant_key}; review before retry.`);
      // The OpenRouter default route stays the headline; endpoint rows never are.
      await save('api_channel_price_variants', v, { model_id: large4.id, is_headline: v.variant_key === 'openrouter-auto' }, `move Large 4/${v.variant_key}`);
    } else {
      // Existing floor/default rows may contain stale mixed prices. Daily scrape rebuilds them.
      await save('api_channel_price_variants', v, { is_available: false, is_headline: false }, `retire stale Mistral/${v.variant_key}`);
    }
  }

  // Repair rows moved by an earlier apply: the moved openrouter-auto row kept the OLD Large
  // $2/$6 route price (variants.headline_drift vs the $0.68/$2.09 channel row, which matches
  // OpenRouter /api/v1/models for mistralai/mistral-large-4-0 on 2026-10-15). Align it with the
  // Large 4 channel price and keep it as the only headline; the daily scrape refreshes it.
  const large4Channel = rows.api_channel_prices.find(r => r.model_id === large4.id && r.provider_id === or.id);
  const large4Variants = rows.api_channel_price_variants.filter(r => r.model_id === large4.id && r.provider_id === or.id && r.is_available !== false);
  const auto = large4Variants.find(r => r.variant_key === 'openrouter-auto');
  if (auto && large4Channel) {
    await save('api_channel_price_variants', auto, {
      input_price_per_1m: large4Channel.input_price_per_1m, output_price_per_1m: large4Channel.output_price_per_1m,
      is_headline: true,
    }, 'Large 4 headline/openrouter-auto');
  }

  // Source-owned static verticals, just like the audited world-model catalog.
  for (const item of AI_VERTICAL_CATALOG.filter(i => isAuditOwnedVertical(i) && !i.deferredDbSeed)) {
    const ownerSlug = item.providerSlug ?? item.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const owner = await provider(ownerSlug, item.provider);
    // Snap's decision catalog view shares the P0 token API row and its identity.
    const isSnap = item.slug === 'subq-snap';
    const fields = auditVerticalModelFields(item);
    // subq-snap shares the P0 SQL row: never flip its taxonomy here (deploy seed owns it).
    const snapCategory = isSnap ? rows.models.find(r => r.slug === item.slug)?.model_category as string | undefined : undefined;
    const m = await model(item.slug!, item.name, owner?.id ?? null, snapCategory ?? fields.model_category, {
      pricing_unit: fields.pricing_unit,
      offical_link: item.url ?? item.sourceUrls?.[0]?.url ?? null,
      ...(item.contextWindow != null ? { context_window: item.contextWindow } : item.contextWindowLabel ? { context_window: null } : {}),
      description: fields.description,
    });
    if (isSnap && owner) {
      await channel(m.id, owner.id, item.inputPricePer1M ?? null, item.outputPricePer1M ?? null,
        `Public Preview. Source: ${item.url}`);
    }
    const units = item.kind === 'decision-model'
      ? [['input_tokens', 'per_1m_tokens', item.inputPricePer1M ?? null], ['output_tokens', 'per_1m_tokens', item.outputPricePer1M ?? null], ['tasks', 'per_1m_tasks', null]] as const
      : [[item.billingUnit === 'per_second' ? 'video_second' : item.billingUnit === 'per_song' ? 'generation' : 'availability', item.billingUnit === 'per_song' ? 'song' : item.billingUnit === 'per_second' ? 'second' : 'unknown', item.pricePerUnit ?? null]] as const;
    for (const [kind, unit, price] of units) {
      const candidates = rows.usage_prices.filter(r => r.model_id === m.id && r.provider_id === (owner?.id ?? null) && r.price_kind === kind && r.plan_id == null);
      const existing = one('usage_prices', candidates, `${item.slug}/${kind}`);
      await save('usage_prices', existing, { model_id: m.id, provider_id: owner?.id ?? null, plan_id: null,
        price_kind: kind, unit, price, currency: item.currency ?? 'USD', is_available: item.status !== 'discontinued',
        constraints_json: { price_status: price == null ? 'needs-verification' : item.priceStatus,
          ...(item.pricePerUnitHigh == null ? {} : { price_high: item.pricePerUnitHigh }),
          ...(item.approximatePrice ? { approximate: true } : {}),
          ...(item.contextWindowLabel ? { context_window_label: item.contextWindowLabel } : {}), notes: item.notes ?? null },
        source_url: item.sourceUrls?.[0]?.url ?? null, last_verified: item.verifiedAt ? AUDIT_TIMESTAMP : null,
      }, `${item.slug}/${kind}`);
    }
  }

  const openai = rows.providers.find(r => r.slug === 'openai');
  for (const p of rows.plans.filter(r => r.provider_id === openai?.id && r.slug === 'chatgpt-pro')) {
    await save('plans', p, { name: 'ChatGPT Pro $200 (Legacy, ends 2026-10-29)', legacy_ends_on: '2026-10-29',
      access_from_china: false, features: cleanLegacyFeatures(p.features), quotas: [],
      notes: LEGACY_PRO_NOTE, source: 'manual', last_verified: AUDIT_TIMESTAMP }, 'openai/chatgpt-pro');
  }
  const anthropic = rows.providers.find(r => r.slug === 'anthropic');
  const maxes = rows.plans.filter(r => r.provider_id === anthropic?.id && ['claude-max', 'claude-max-5x', 'claude-max-20x'].includes(String(r.slug)));
  const generic = one('plans', maxes.filter(r => r.slug === 'claude-max'), 'claude-max');
  let max5 = one('plans', maxes.filter(r => r.slug === 'claude-max-5x'), 'claude-max-5x');
  if (generic && generic.price !== 100) throw new Error('Expected generic Claude Max $100; refusing ambiguous dedupe.');
  if (generic && max5) {
    if (max5.price !== 100) throw new Error('Expected Claude Max (5x) $100; refusing ambiguous dedupe.');
    if (generic.notes && !String(max5.notes ?? '').includes(String(generic.notes))) {
      await save('plans', max5, { notes: [max5.notes, generic.notes].filter(Boolean).join('\n') }, 'preserve duplicate Max notes');
    }
    steps.push({ table: 'plans', target: 'claude-max → claude-max-5x', action: 'merge', changes: { from: generic.id, to: max5.id, references: ['model_plan_mapping', 'usage_prices', 'quota_estimates (if installed)'] } });
    if (apply) {
      await tx`UPDATE model_plan_mapping kept SET source = 'manual'
        FROM model_plan_mapping old WHERE kept.plan_id = ${max5.id} AND old.plan_id = ${generic.id}
        AND kept.model_id = old.model_id AND old.source = 'manual' AND kept.source <> 'manual'`;
      await tx`INSERT INTO model_plan_mapping (model_id, plan_id, priority, source)
        SELECT m.model_id, ${max5.id}, m.priority, m.source FROM model_plan_mapping m
        WHERE m.plan_id = ${generic.id} AND NOT EXISTS (
          SELECT 1 FROM model_plan_mapping x WHERE x.model_id = m.model_id AND x.plan_id = ${max5.id})`;
      await tx`DELETE FROM model_plan_mapping WHERE plan_id = ${generic.id}`;
      await tx`UPDATE usage_prices SET plan_id = ${max5.id} WHERE plan_id = ${generic.id}`;
      const [quota] = await tx<Array<{ present: boolean }>>`SELECT to_regclass('quota_estimates') IS NOT NULL AS present`;
      if (quota.present) await tx`UPDATE quota_estimates SET plan_id = ${max5.id} WHERE plan_id = ${generic.id}`;
      await tx`DELETE FROM plans WHERE id = ${generic.id}`;
    }
  } else if (generic) {
    await save('plans', generic, { slug: 'claude-max-5x', name: 'Claude Max (5x)' }, 'canonicalize Claude Max $100');
    max5 = generic;
  }
  for (const p of maxes.filter(r => r !== generic || r === max5)) {
    if (p.price !== 100 && p.price !== 200) throw new Error(`Unexpected Claude Max price on ${p.slug}; review audit scope.`);
    await save('plans', p, { access_from_china: false, monthly_api_credit_usd: null,
      monthly_api_credit_status: 'needs-verification', notes: String(p.notes ?? '').includes(MAX_API_CREDIT_NOTE) ? p.notes : [p.notes, MAX_API_CREDIT_NOTE].filter(Boolean).join('\n'),
      source: 'manual', last_verified: AUDIT_TIMESTAMP }, `anthropic/${p.slug}`);
  }
  return steps;
}
