import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Sql } from 'postgres';
import ts from 'typescript';
import { COPILOT_PREVIEW_SELECTOR } from '../../src/lib/copilot';
import { buildProviderCopy, type ProviderCopyPlan } from '../../src/lib/provider-copy';
import { buildComparisonPricingCopy, monthlyPlanFloors, type SeoPlan } from '../../src/lib/pricing-seo';
import { planEconomics, type EconomicPlan } from '../../src/lib/plan-economics';
import { planEntitlementTrust, planPriceTrust, type PlanTrustRow } from '../../src/lib/data-trust';
import { resolveSelector, type ModelSelector } from '../../src/lib/plan-selector';
import { QUOTA_TEXT_SOURCES } from '../config/quota-text-sources';
import { generateOpenRouterSlug } from '../scrapers/openrouter';
import { COPILOT_PLANS, COPILOT_SOURCE, COPILOT_ACCESS_SOURCE, COPILOT_BILLING_SOURCE, COPILOT_DOCS_SOURCE, HYDRAFUSION_SOURCE, copilotSeedOptions, seedCopilot } from './copilot-2026-10-15';

type Row = Record<string, unknown> & { id: number };
const catalog = ['claude-opus-5.5', 'gpt-6-astra', 'openai-gpt-6-1-sol', 'gpt-6-luna'].map((slug, index) => ({
  id: index + 20, slug, providerSlugs: [index ? 'openai' : 'anthropic'], elo: null,
}));

/** Memory-only SQL interpreter. Unexpected queries/imports fail closed. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: catalog, plans: [], model_plan_mapping: [], ...structuredClone(initial) };
  let nextId = 10000;
  let readOnly = false;
  let ended = false;
  let writes = 0;
  const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query === 'SET TRANSACTION READ ONLY') { readOnly = true; return Promise.resolve([]); }
    if (query === "SELECT * FROM providers WHERE slug = 'github'") return Promise.resolve(structuredClone(data.providers.filter(row => row.slug === 'github')));
    if (query === 'SELECT * FROM plans WHERE provider_id = ?') return Promise.resolve(structuredClone(data.plans.filter(row => row.provider_id === values[0])));
    if (query.startsWith('SELECT model.id, model.slug,')) {
      assert.match(query, /model.shutdown_date IS NULL/);
      return Promise.resolve(structuredClone(data.models));
    }
    if (query === 'SELECT * FROM model_plan_mapping WHERE plan_id IN ?') return Promise.resolve(structuredClone(data.model_plan_mapping.filter(row => (fragment(values[0]) as number[]).includes(row.plan_id as number))));
    assert.equal(readOnly, false, `Write in read-only transaction: ${query}`);
    if (query === "DELETE FROM model_plan_mapping WHERE id = ? AND source = 'derived'") {
      data.model_plan_mapping = data.model_plan_mapping.filter(row => row.id !== values[0] || row.source !== 'derived');
      writes++; return Promise.resolve([]);
    }
    assert.match(query, /^(INSERT INTO|UPDATE) /, `Unexpected SQL: ${query}`);
    const table = String(fragment(values[0]));
    assert.ok(['providers', 'plans', 'model_plan_mapping'].includes(table), `Unexpected write to ${table}`);
    const raw = fragment(values[1]) as Record<string, unknown>;
    const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key,
      value && typeof value === 'object' && 'json' in value ? value.json : value]));
    for (const key of ['features', 'quotas', 'model_selector']) {
      if (payload[key] != null) assert.ok(raw[key] && typeof raw[key] === 'object' && 'json' in raw[key], `${key} must use SQL JSON serialization`);
    }
    if (table === 'model_plan_mapping') assert.ok(!('updated_at' in payload));
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const keys = table === 'providers' ? ['slug'] : table === 'plans' ? ['provider_id', 'slug'] : ['plan_id', 'model_id'];
      assert.ok(!data[table].some(row => keys.every(key => row[key] === payload[key])), `Duplicate ${table}`);
      for (const [key, parent] of [['provider_id', 'providers'], ['product_id', 'providers'], ['plan_id', 'plans'], ['model_id', 'models']]) {
        if (payload[key] !== undefined) assert.ok(data[parent].some(row => row.id === payload[key]), `Missing ${parent}`);
      }
      const row = { ...payload, id: nextId++ };
      data[table].push(row); writes++; return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      const row = data[table].find(row => row.id === values[2]);
      assert.ok(row); Object.assign(row, payload); writes++; return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  const sql = Object.assign(tx, {
    json: (value: unknown) => ({ json: value }),
    async begin(mode: string, callback: (tx: unknown) => Promise<void>) {
      assert.equal(mode, 'isolation level serializable');
      readOnly = false;
      const before = structuredClone(data);
      try { await callback(sql); } catch (error) { Object.assign(data, before); throw error; }
    },
    async end() { ended = true; },
  }) as unknown as Sql;
  async function cli(args: string[] = []) {
    const source = readFileSync(new URL('../seed-copilot-2026-10-15.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const messages: string[] = [];
    const process = { argv: ['node', 'seed-copilot', ...args], exitCode: 0 };
    const dependencies: Record<string, unknown> = {
      './data/copilot-2026-10-15': { copilotSeedOptions, seedCopilot }, './db/postgres-admin': { databaseSql: sql },
    };
    await runInNewContext(compiled, {
      exports: {}, process,
      require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
      console: { log: (...values: unknown[]) => messages.push(values.join(' ')), error: (error: unknown) => messages.push(String(error)) },
    });
    return { code: process.exitCode, output: messages.join('\n') };
  }
  return { data, sql, cli, writes: () => writes, readOnly: () => readOnly, ended: () => ended };
}

test('actual CLI defaults to SELECT-only dry-run; unsafe flags fail; npm scripts and monitor source are safe', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const result = await f.cli();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Dry-run; no writes/);
  assert.match(result.output, /copilot-enterprise/);
  assert.match(result.output, /copilot-standalone/);
  assert.doesNotMatch(result.output, /Unverified: Business\/Enterprise seat prices/);
  assert.ok(f.readOnly()); assert.ok(f.ended()); assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(copilotSeedOptions([]), { apply: false });
  assert.deepEqual(copilotSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(copilotSeedOptions(['--apply']), { apply: true });
  for (const args of [['--apply', '--dry-run'], ['--unknown'], ['--apply=true']]) assert.throws(() => copilotSeedOptions(args), /Usage:/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:copilot'], 'tsx scripts/seed-copilot-2026-10-15.ts');
  assert.equal(pkg.scripts['seed:copilot:apply'], `${pkg.scripts['seed:copilot']} --apply`);
  assert.ok(QUOTA_TEXT_SOURCES.some(source => source.url === COPILOT_SOURCE && source.enabled !== false));
  for (const file of ['../../deploy/production/rollout.sh', '../audit-vertical-catalog.ts']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /seed:copilot|copilot-(?:free|pro|max|business|enterprise)/);
  }
});

test('memory-only apply creates seven plans with verified prices, derived preview models, and no-op reruns', async () => {
  const f = fixture();
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.equal(f.data.providers.length, 1);
  assert.equal(f.data.providers[0].slug, 'github');
  assert.deepEqual(f.data.models, catalog);
  assert.equal(f.data.plans.length, 7);
  assert.equal(f.data.model_plan_mapping.length, 20);
  assert.deepEqual(COPILOT_PLANS.map(plan => [plan.slug, plan.price, plan.credits]), [
    ['copilot-free', 0, null], ['copilot-pro', 10, 1500], ['copilot-pro-plus', 39, 7000],
    ['copilot-max', 100, 20000], ['copilot-business', 19, 1900],
    ['copilot-enterprise', 39, 3900], ['copilot-standalone', 10, 0],
  ]);
  for (const [index, plan] of f.data.plans.entries()) {
    const fact = COPILOT_PLANS[index];
    assert.equal(plan.price, fact.price);
    assert.equal(plan.product_id, f.data.providers[0].id);
    assert.equal(plan.provider_id, f.data.providers[0].id);
    assert.equal(plan.source, 'manual'); assert.equal(plan.quota_unit, 'credits');
    assert.equal(plan.data_for_discount, false);
    assert.equal(plan.included_credits, fact.credits);
    assert.equal(plan.included_usage_amount, fact.credits);
    assert.equal(plan.included_usage_unit, fact.credits === null ? null : 'credit');
    assert.equal(plan.annual_price, null);
    assert.equal(plan.price_yearly_monthly, null);
    assert.equal(plan.region, null);
    assert.equal(plan.last_verified instanceof Date && plan.last_verified.toISOString(), '2026-10-29T00:00:00.000Z');
    assert.match(String(plan.notes), /1 credit = \$0\.01/);
    assert.match(String(plan.notes), /Flex credits may change/);
    assert.match(String(plan.notes), /\[needs-verification\] Annual pricing, regional access and payment methods/);
    for (const note of [
      ...String(plan.notes).split('\n'), ...(plan.features as string[]),
      ...String(plan.third_party_coverage_note).split('\n'), String(plan.data_for_discount_note),
      ...((plan.quotas ?? []) as Array<{ note: string }>).map(quota => quota.note),
    ]) {
      assert.match(note, /https:\/\/(?:github\.com|github\.blog|docs\.github\.com)\//);
      assert.match(note, /verified 2026-10-29/);
    }
    const mappings = f.data.model_plan_mapping.filter(row => row.plan_id === plan.id);
    if (plan.model_selector) {
      const selected = resolveSelector(plan.model_selector as ModelSelector, catalog).models;
      assert.deepEqual(mappings.map(row => row.model_id), selected.map(model => model.id));
      assert.ok(mappings.every((row, priority) => row.source === 'derived' && row.priority === priority));
      assert.ok(String(plan.notes).includes(HYDRAFUSION_SOURCE));
      assert.match(String(plan.notes), /HydraFusion and HydraFusion Max: research preview/);
      assert.match(String(plan.notes), /\[needs-verification\] Billing multiplier undisclosed/);
    } else assert.equal(mappings.length, 0);
    // JSONB key order differs from the insertion order in PostgreSQL.
    if (plan.model_selector) plan.model_selector = Object.fromEntries(Object.entries(plan.model_selector).reverse());
  }
  assert.match(String(f.data.plans[0].notes), /2,000 completions \+ 50 chat requests/);
  for (const plan of f.data.plans.slice(0, 3)) assert.match(String(plan.notes), /training unless opted out/);
  for (const plan of f.data.plans.slice(4, 6)) {
    assert.match(String(plan.notes), /not used for training/);
    assert.match(String(plan.notes), /per user per month/);
    assert.match(String(plan.notes), /pooled across the organization/);
    assert.ok(String(plan.notes).includes(COPILOT_BILLING_SOURCE));
    assert.doesNotMatch(String(plan.notes), /\[needs-verification\] Per-seat price/);
    assert.deepEqual((plan.quotas as Array<Record<string, unknown>>).map(({ amount, unit, period }) => ({ amount, unit, period })),
      [{ amount: plan.included_credits, unit: 'credit', period: 'month' }]);
  }
  assert.match(String(f.data.plans[5].notes), /organizations using GitHub Enterprise Cloud/);
  assert.match(String(f.data.plans[3].notes), /\[needs-verification\] Max plan training policy/);
  const writes = f.writes();
  assert.deepEqual(await seedCopilot(f.sql, true), []);
  assert.equal(f.writes(), writes);
  assert.deepEqual(await seedCopilot(f.sql), []);
});

test('Standalone has a seat fee plus metered budget, no allowance, and the same selector as Enterprise', async () => {
  const f = fixture();
  await seedCopilot(f.sql, true);
  const standalone = f.data.plans.find(plan => plan.slug === 'copilot-standalone')!;
  const enterprise = f.data.plans.find(plan => plan.slug === 'copilot-enterprise')!;
  assert.equal(standalone.price, 10);
  assert.equal(standalone.price_unit, 'per_month');
  assert.equal(standalone.pricing_model, 'subscription');
  assert.equal(standalone.billing_granularity, 'flat_monthly');
  assert.equal(standalone.plan_line, 'github-copilot');
  assert.equal(standalone.tier, 'enterprise');
  assert.equal(standalone.is_contact_sales, false);
  assert.equal(standalone.included_credits, 0);
  assert.equal(standalone.included_usage_amount, 0);
  assert.deepEqual(standalone.quotas, []);
  assert.equal(standalone.monthly_api_credit_usd, null);
  assert.equal(standalone.monthly_api_credit_status, null);
  assert.equal(standalone.monthly_message_limit, null);
  assert.equal(standalone.requests_per_month, null);
  assert.deepEqual(standalone.model_selector, enterprise.model_selector);
  const modelIds = (plan: Row) => f.data.model_plan_mapping.filter(row => row.plan_id === plan.id).map(row => row.model_id);
  assert.deepEqual(modelIds(standalone), modelIds(enterprise));
  assert.match((standalone.features as string[])[0], /\$10 USD per user per month/);
  assert.match((standalone.features as string[])[0], /no included AI credits; metered usage billed separately from first use/);
  assert.match((standalone.features as string[])[1], /Sales-assisted only through a GitHub\/Microsoft account team/);
  assert.match((standalone.features as string[])[1], /Self-serve is not yet available/);
  const notes = String(standalone.notes);
  for (const source of [COPILOT_ACCESS_SOURCE, COPILOT_BILLING_SOURCE, COPILOT_DOCS_SOURCE]) assert.ok(notes.includes(source));
  for (const claim of [/at model rates against the enterprise budget/, /Sales-assisted only/, /2026-10-28/,
    /Self-serve is not yet available/, /GitHub Free\/Team/, /self-service GitHub Enterprise Cloud trials/,
    /Same features and model eligibility as Copilot Enterprise/, /Code completion and next edit suggestions work with no budget/,
    /Copilot Chat, code review and Copilot cloud agent require available enterprise budget/, /exhausted budget never removes the seat/,
    /cannot coexist with Business\/Enterprise seats in the same enterprise/, /\$0 Copilot seat charge/,
    /license cost excluded here/, /Enterprise owners must still assign seats/, /this option can coexist with Standalone/]) {
    assert.match(notes, claim);
  }
  // The GHE bundle is documented inside Standalone, never offered as a free row.
  assert.deepEqual(f.data.plans.filter(plan => plan.price === 0).map(plan => plan.slug), ['copilot-free']);
  assert.equal(planEconomics({ ...standalone, pack_validity_days: null } as unknown as EconomicPlan).state, 'none_published');
  // A public seat fee now participates in price floors; it is not a usage budget.
  assert.deepEqual(monthlyPlanFloors([standalone as unknown as SeoPlan]), [
    { price: 10, currency: 'USD', name: 'Copilot Standalone' },
  ]);
  for (const locale of ['en', 'zh'] as const) {
    const copy = buildProviderCopy({ name: 'GitHub', plans: [standalone, enterprise] as unknown as ProviderCopyPlan[], modelCount: 4 }, locale);
    assert.ok(copy.summary.includes('Copilot Standalone'));
    assert.ok(!copy.summary.includes('Copilot Enterprise'));
    const source = { label: 'GitHub billing', url: COPILOT_BILLING_SOURCE };
    const now = new Date('2026-10-29T12:00:00Z');
    assert.equal(planPriceTrust(standalone as PlanTrustRow, source, locale, now).flags.unverified, false);
    assert.equal(planEntitlementTrust(standalone as PlanTrustRow, source, locale, now).flags.unverified, false);
  }
});

test('Pro retains the $10 tie in tier-ordered copy; seat-only SEO floors remain a documented ranking caveat', async () => {
  const f = fixture();
  await seedCopilot(f.sql, true);
  const pro = f.data.plans.find(plan => plan.slug === 'copilot-pro')!;
  const standalone = f.data.plans.find(plan => plan.slug === 'copilot-standalone')!;
  assert.equal(pro.tier_rank, 1);
  assert.equal(standalone.tier_rank, 6);
  assert.ok(Number(pro.tier_rank) < Number(standalone.tier_rank));
  const plans = f.data.plans as unknown as SeoPlan[];
  // Full GitHub metadata still starts at $0 because Free is present.
  assert.deepEqual(monthlyPlanFloors(plans), [{ price: 0, currency: 'USD', name: 'Copilot Free' }]);
  // Model comparisons share Pro's pool. First equal-price row wins the floor.
  const mappedPlans = f.data.plans.filter(plan => plan.model_selector) as unknown as SeoPlan[];
  assert.deepEqual(monthlyPlanFloors(mappedPlans), [{ price: 10, currency: 'USD', name: 'Copilot Pro' }]);
  for (const locale of ['en', 'zh'] as const) {
    const copy = buildProviderCopy({ name: 'GitHub', plans: f.data.plans as unknown as ProviderCopyPlan[], modelCount: 4 }, locale);
    assert.ok(copy.summary.includes('Copilot Pro'));
    assert.ok(!copy.summary.includes('Copilot Standalone'));
    assert.ok(copy.faqs.some(faq => faq.answer.includes('Copilot Pro')));
    assert.ok(copy.faqs.every(faq => !faq.answer.includes('Copilot Standalone')));
    // Without Pro, generic metadata treats the seat fee as an unqualified floor.
    const seo = buildComparisonPricingCopy('Preview model', [standalone as unknown as SeoPlan], locale, 2026);
    assert.ok(seo.title.includes('$10'));
    assert.ok(!seo.description.includes('enterprise budget'));
  }
});

test('selector matches only the verified pool, tolerates missing models, and never creates priced HydraFusion models', async () => {
  const noise = ['gpt-6-astra-pro', 'gpt-6-astra-batch', 'openai-gpt-6-1-sol-pro', 'claude-opus-5.5-long-context', 'claude-opus-5.6', 'hydrafusion', 'hydrafusion-max'];
  const candidates = [...catalog, ...noise.map((slug, index) => ({ id: 100 + index, slug, providerSlugs: ['openai', 'anthropic'], elo: null }))];
  assert.deepEqual(resolveSelector(COPILOT_PREVIEW_SELECTOR, candidates).models.map(model => model.id).sort(), catalog.map(model => model.id).sort());
  const aliases = ['anthropic/claude-opus-5.5', 'openai/gpt-6-astra', 'openai/gpt-6.1-sol', 'openai/gpt-6-luna']
    .map((id, index) => ({ id: 500 + index, slug: generateOpenRouterSlug(id), providerSlugs: [id.split('/')[0]], elo: null }));
  assert.equal(resolveSelector(COPILOT_PREVIEW_SELECTOR, aliases).models.length, 4);
  const f = fixture({ models: [] });
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Missing catalog models are skipped/);
  assert.equal(f.data.models.length, 0);
  assert.equal(f.data.plans.length, 7);
  assert.equal(f.data.model_plan_mapping.length, 0);
  // A NULL selector emits only the existing missing-selector warning; no empty-selector critical.
  assert.ok(f.data.plans.every(plan => plan.model_selector === null));
});

test('repairs old NULL organization prices and stale derived mappings while preserving manual mappings and unrelated records', async () => {
  const f = fixture({
    providers: [{ id: 1, slug: 'github', name: 'GitHub', logo_url: '/existing.svg' }],
    plans: [{ id: 2, provider_id: 1, slug: 'copilot-business', price: null, included_credits: null, last_verified: null, notes: '[needs-verification] Per-seat price', annual_price: 999, monthly_message_limit: 999 },
      { id: 3, provider_id: 1, slug: 'unrelated', price: 123 },
      { id: 6, provider_id: 1, slug: 'copilot-enterprise', price: null, included_credits: null, last_verified: null },
      { id: 7, provider_id: 1, slug: 'copilot-standalone', price: 10, is_contact_sales: true }],
    model_plan_mapping: [{ id: 4, plan_id: 2, model_id: 20, source: 'manual', priority: 8 },
      { id: 5, plan_id: 2, model_id: 999, source: 'derived', priority: 0 }],
  });
  const before = structuredClone(f.data);
  const steps = await seedCopilot(f.sql);
  assert.ok(steps.length);
  assert.deepEqual(steps.filter(step => step.action === 'delete'), [{
    table: 'model_plan_mapping', target: 'copilot-business/999', action: 'delete',
    changes: { model_id: { from: 999, to: null } },
  }]);
  assert.equal(f.writes(), 0); assert.deepEqual(f.data, before);
  await seedCopilot(f.sql, true);
  const business = f.data.plans.find(plan => plan.id === 2)!;
  assert.equal(business.price, 19); assert.equal(business.included_credits, 1900);
  assert.equal(business.annual_price, null); assert.equal(business.monthly_message_limit, null);
  assert.doesNotMatch(String(business.notes), /\[needs-verification\] Per-seat price/);
  const enterprise = f.data.plans.find(plan => plan.id === 6)!;
  assert.equal(enterprise.price, 39); assert.equal(enterprise.included_credits, 3900);
  const standalone = f.data.plans.find(plan => plan.id === 7)!;
  assert.equal(standalone.price, 10); assert.equal(standalone.is_contact_sales, false);
  assert.equal(standalone.included_credits, 0); assert.deepEqual(standalone.quotas, []);
  assert.equal(f.data.providers[0].logo_url, '/existing.svg');
  assert.equal(f.data.providers[0].pricing_url, COPILOT_SOURCE);
  assert.deepEqual(f.data.models, before.models);
  assert.deepEqual(f.data.plans.find(plan => plan.id === 3), before.plans[1]);
  assert.deepEqual(f.data.model_plan_mapping.find(row => row.id === 4), before.model_plan_mapping[0]);
  assert.ok(!f.data.model_plan_mapping.some(row => row.id === 5));
  assert.deepEqual(await seedCopilot(f.sql, true), []);
});

test('ambiguous identities abort atomically and close the client', async () => {
  const f = fixture({ providers: [{ id: 1, slug: 'github' }], plans: [
    { id: 2, provider_id: 1, slug: 'copilot-business' }, { id: 3, provider_id: 1, slug: 'copilot-business' },
  ] });
  const before = structuredClone(f.data);
  const result = await f.cli(['--apply']);
  assert.equal(result.code, 1); assert.match(result.output, /Ambiguous plans\/copilot-business/);
  assert.deepEqual(f.data, before); assert.ok(f.ended());
});
