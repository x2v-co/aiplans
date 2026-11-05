import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DECISION_1103_SPECS, DECISION_MODELS_2026_11_03 } from '../../src/lib/decision-models-2026-11-03';
import { isExplicitlyUnverifiedPrice, isOpenRouterPublishedFree, isVerifiedFreeOutput, isVerifiedFreePrice } from '../utils/audit-price-policy';
import { auditExitCode, missingPlanFields } from '../utils/audit-plan-policy';
import { isSupersededPlan } from '../../src/lib/plan-lifecycle';
import { GEMINI_API_CHANNEL, catalog20261103FixSeedOptions, isLegacyVeoUsageRow, seedCatalog20261103Fix } from './catalog-2026-11-03-fix';
import { seedCatalog20261103P1 } from './catalog-2026-11-03-p1';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

const compile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// ---------- Problem 1: input-only decision models in the DB audit ----------

test('input-only policy covers exactly the 8 verified specs on their verified channel', () => {
  assert.equal(DECISION_1103_SPECS.length, 8);
  for (const spec of DECISION_1103_SPECS) {
    assert.equal(spec.inputOnly, true, spec.slug);
    const channels = spec.channel === 'vercel' ? ['vercel-ai-gateway', 'vercel'] : ['cloudflare'];
    for (const provider of channels) {
      assert.equal(isVerifiedFreeOutput(spec.slug, provider, spec.input), true, `${spec.slug}@${provider}`);
      assert.equal(isVerifiedFreeOutput(spec.slug, provider, spec.input * 2), true, 'a later input price change stays exempt');
      for (const input of [0, -1, null]) assert.equal(isVerifiedFreeOutput(spec.slug, provider, input), false, 'input must stay positive');
    }
    for (const other of ['openrouter', 'together-ai', spec.channel === 'vercel' ? 'cloudflare' : 'vercel-ai-gateway', undefined]) {
      assert.equal(isVerifiedFreeOutput(spec.slug, other, spec.input), false, `${spec.slug}@${other}`);
    }
    assert.equal(isVerifiedFreePrice(spec.slug, channels[0]), false, 'input is never free');
  }
  for (const slug of ['gpt-oss-120b', 'cloudflare-clef-2', 'clef', undefined]) assert.equal(isVerifiedFreeOutput(slug, 'cloudflare', 0.24), false);
  // Earlier exceptions are unchanged.
  assert.equal(isVerifiedFreeOutput('scaledown-extract', 'openrouter', 0.1), true);
  assert.equal(isVerifiedFreeOutput('perplexity-pplx-decider-v1-2', 'vercel-ai-gateway', 0.02), true);
  assert.equal(isVerifiedFreeOutput('subq-snap', 'subq', 0.05), true);
});

async function auditFindings(tables: Record<string, FakeRow[]>) {
  const messages: string[] = [];
  const process = { argv: ['node', 'audit-data', '--json'], exitCode: 0, exit(code: number) { throw new Error(`Audit exited ${code}: ${messages.join('\n')}`); } };
  const all = { plans: [], model_plan_mapping: [], exchange_rates: [], ...tables };
  const db = { from(table: string) {
    assert.ok(Object.hasOwn(all, table), table);
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: all[table as keyof typeof all], error: null }).then(resolve),
    };
    return builder;
  } };
  const databaseSql = async (parts: TemplateStringsArray) => {
    assert.match(parts.join('?'), /information_schema.columns|FROM model_benchmark_scores AS score/);
    return [];
  };
  const dependencies: Record<string, unknown> = {
    './utils/audit-price-policy': { isExplicitlyUnverifiedPrice, isOpenRouterPublishedFree, isVerifiedFreeOutput, isVerifiedFreePrice },
    './utils/audit-plan-policy': { auditExitCode, missingPlanFields },
    './db/queries': { db }, './db/postgres-admin': { databaseSql },
    '../src/lib/plan-lifecycle': { isSupersededPlan },
    '../src/lib/plan-selector': { resolveSelector() { throw new Error('Unexpected selector resolution'); } },
    './scrapers/modelsdev': { fetchModelsDevCatalog: async () => { throw new Error('Offline test'); }, PLAN_DRIFT_SKIP: new Set() },
  };
  await runInNewContext(compile('../audit-data.ts'), {
    exports: {}, process,
    require(name: string) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name]; },
    console: { log: (message: string) => messages.push(message), error: (error: unknown) => messages.push(String(error)) },
  });
  return (JSON.parse(messages.join('\n')) as { findings: { check: string; severity: string; message?: string; ref?: { price_id: number } }[] }).findings;
}

const baseProviders = () => [
  { id: 7, slug: 'google', type: 'producer', name: 'Google' },
  { id: 8, slug: 'vercel-ai-gateway', type: 'aggregator', name: 'Vercel AI Gateway' },
  { id: 9, slug: 'liquid', type: 'official', name: 'Liquid AI' },
  { id: 10, slug: 'openrouter', type: 'aggregator', name: 'OpenRouter' },
];
const veoModels = () => ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite', 'veo'].map((slug, i) => ({ id: 1 + i, slug, name: slug }));

test('real DB audit: the seeded 8 decision channels are no longer critical; other zero outputs still are (memory only)', async () => {
  const f = fakeSeedTx({ providers: baseProviders(), models: veoModels() });
  await seedCatalog20261103P1(f.tx as never, true);
  const decision = f.data.api_channel_prices;
  assert.equal(decision.length, 8);
  assert.ok(decision.every(row => row.output_price_per_1m === 0 && Number(row.input_price_per_1m) > 0));
  const decisionModel = (slug: string) => f.data.models.find(m => m.slug === slug)!;
  const openrouterCopy = { ...decision[0], id: 9001, provider_id: 10 };
  const llm = { id: 50, slug: 'some-llm', name: 'Some LLM' };
  const llmZero = { ...decision[0], id: 9002, model_id: 50, provider_id: 10 };
  const findings = await auditFindings({ ...f.data, models: [...f.data.models, llm], api_channel_prices: [...decision, openrouterCopy, llmZero] });
  const zero = findings.filter(x => x.check === 'prices.zero_or_null');
  assert.deepEqual(zero.map(x => x.ref?.price_id).sort(), [9001, 9002], JSON.stringify(zero));
  for (const row of decision) assert.ok(!findings.some(x => x.ref?.price_id === row.id && x.severity === 'critical'), String(row.id));
  assert.equal(decisionModel('cloudflare-clef').model_category, 'decision');
  // Catalog and seed agree that output is free.
  for (const item of DECISION_MODELS_2026_11_03) assert.equal(item.outputPricePer1M, 0);
});

// ---------- Problem 2: retire the shut-down Gemini API Veo rows ----------

const vertex = (id: number, model_id: number, price_kind: string, price: number, plan_id: number | null = 2053) =>
  ({ id, model_id, provider_id: 7, plan_id, price_kind, unit: 'second', price: String(price), currency: 'USD', is_available: true,
    source_url: 'https://cloud.google.com/vertex-ai/generative-ai/pricing', constraints_json: { channel: 'Vertex AI' } });
const prodLike = () => ({
  providers: baseProviders(),
  models: veoModels(),
  usage_prices: [
    // usage_prices#62: the pre-Vertex Gemini API row the page rendered.
    { id: 62, model_id: 1, provider_id: 7, plan_id: null, price_kind: 'video_second', unit: 'second', price: '0.4', currency: 'USD',
      is_available: true, source_url: 'https://ai.google.dev/gemini-api/docs/pricing', constraints_json: { confidence: 'verified', price_high: 0.4 } },
    { id: 63, model_id: 2, provider_id: 7, plan_id: null, price_kind: 'video_second', unit: 'second', price: '0.1', currency: 'USD',
      is_available: true, source_url: 'https://ai.google.dev/gemini-api/docs/pricing', constraints_json: null },
    // Already off, but not yet labelled.
    { id: 64, model_id: 3, provider_id: 7, plan_id: 2055, price_kind: 'video_second', unit: 'second', price: '0.05', currency: 'USD',
      is_available: false, source_url: 'https://ai.google.dev/gemini-api/docs/pricing', constraints_json: { confidence: 'verified' } },
    vertex(599, 1, 'veo-3.1 720p/1080p (video + audio)', 0.4), vertex(600, 1, 'veo-3.1 4K (video + audio)', 0.6),
    vertex(601, 1, 'veo-3.1 720p/1080p (video only)', 0.2), vertex(602, 1, 'veo-3.1 4K (video only)', 0.4),
    vertex(610, 3, 'veo-3.1-lite 720p (video only)', 0.03, null),
    // Another provider's row for the same model is never touched.
    { id: 700, model_id: 1, provider_id: 10, plan_id: null, price_kind: 'video_second', unit: 'second', price: '0.5', is_available: true },
  ] as FakeRow[],
});

test('fix seed CLI options default to dry-run', () => {
  assert.equal(catalog20261103FixSeedOptions([]).apply, false);
  assert.equal(catalog20261103FixSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force']]) assert.throws(() => catalog20261103FixSeedOptions(args), /Usage/);
});

test('legacy detection never matches a Vertex rate', () => {
  assert.equal(isLegacyVeoUsageRow('veo-3-1', { id: 1, price_kind: 'video_second' }), true);
  assert.equal(isLegacyVeoUsageRow('veo-3-1', { id: 1, price_kind: 'veo-3.1 4K (video only)' }), false);
  assert.equal(isLegacyVeoUsageRow('veo-3-1-lite', { id: 1, price_kind: 'veo-3.1-lite 720p (video only)' }), false);
});

test('dry-run writes nothing; apply retires only the Gemini API rows, keeps history, and replays to zero', async () => {
  const f = fakeSeedTx(prodLike());
  const before = structuredClone(f.data);
  const preview = await seedCatalog20261103Fix(f.tx as never);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(preview.map(s => s.id), [62, 63, 64]);
  assert.deepEqual(Object.keys(preview[2].changes), ['constraints_json'], '#64 is already unavailable; only the label changes');

  const applied = await seedCatalog20261103Fix(f.tx as never, true);
  assert.deepEqual(applied.map(s => s.id), [62, 63, 64]);
  assert.equal(f.writes(), 3);
  const row = (id: number) => f.data.usage_prices.find(r => r.id === id)!;
  for (const id of [62, 63, 64]) {
    assert.equal(row(id).is_available, false);
    assert.deepEqual({ ...(row(id).constraints_json as object) }, { ...(before.usage_prices.find(r => r.id === id)!.constraints_json ?? {}) as object, ...GEMINI_API_CHANNEL });
    for (const key of ['price', 'unit', 'plan_id', 'source_url', 'price_kind']) assert.deepEqual(row(id)[key], before.usage_prices.find(r => r.id === id)![key], `${id}.${key}`);
  }
  for (const id of [599, 600, 601, 602, 610, 700]) assert.deepEqual(row(id), before.usage_prices.find(r => r.id === id), String(id));

  assert.deepEqual(await seedCatalog20261103Fix(f.tx as never, true), []);
  assert.equal(f.writes(), 3);
});

test('ambiguous identities abort before any write', async () => {
  const dup = fakeSeedTx({ ...prodLike(), models: [...veoModels(), { id: 99, slug: 'veo-3-1' }] });
  await assert.rejects(seedCatalog20261103Fix(dup.tx as never, true), /exactly one models\/veo-3-1/);
  const noGoogle = fakeSeedTx({ ...prodLike(), providers: baseProviders().filter(p => p.slug !== 'google') });
  await assert.rejects(seedCatalog20261103Fix(noGoogle.tx as never, true), /providers\/google/);
  assert.equal(dup.writes() + noGoogle.writes(), 0);
});

test('real DB audit: OpenRouter published 0/0 (stealth/free) is a warning; null or other-channel zero stays critical', async () => {
  const providers = [...baseProviders(), { id: 11, slug: 'together-ai', type: 'aggregator', name: 'Together' }];
  const models = [{ id: 60, slug: 'stealth-crouton-alpha', name: 'Crouton Alpha' }, { id: 61, slug: 'paid-llm', name: 'Paid' }];
  const row = (id: number, model_id: number, provider_id: number, input: number | null, output: number | null) => ({
    id, model_id, provider_id, input_price_per_1m: input, output_price_per_1m: output, is_available: true, last_verified: '2026-11-05', currency: 'USD',
  });
  const findings = await auditFindings({ providers, models, api_channel_prices: [
    row(15785, 60, 10, 0, 0), row(15786, 61, 10, null, null), row(15787, 61, 10, 0, null), row(15788, 61, 11, 0, 0),
  ] });
  const critical = findings.filter(x => x.check === 'prices.zero_or_null' && x.severity === 'critical').map(x => x.ref?.price_id);
  assert.ok(!critical.includes(15785), JSON.stringify(findings));
  assert.deepEqual([...new Set(critical)].sort(), [15786, 15787, 15788]);
  assert.ok(findings.some(x => x.check === 'prices.free_published' && x.severity === 'warning' && x.ref?.price_id === 15785));
});
