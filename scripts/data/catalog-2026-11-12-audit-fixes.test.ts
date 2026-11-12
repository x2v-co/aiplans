import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecisionModelCatalog } from '../../src/components/audited-catalog';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { GEMINI_DECISION_1, GEMINI_DECISION_SPEC } from '../../src/lib/decision-models-2026-11-12';
import { isVerifiedFreeOutput, isVerifiedFreePrice } from '../utils/audit-price-policy';
import {
  PRODUCTION_SHAPED_DRY_RUN, catalog20261112AuditFixesSeedOptions, seedCatalog20261112AuditFixes,
  seedStepCounts,
} from './catalog-2026-11-12-audit-fixes';
import { fakeSeedTx } from './fake-seed-tx';

const google = { id: 7, slug: 'google', name: 'Google', type: 'producer' };
const vercel = { id: 8, slug: 'vercel-ai-gateway', name: 'Vercel AI Gateway', type: 'aggregator' };
const base = () => fakeSeedTx({ providers: [google, vercel], models: [] });

test('11-12 CLI defaults to dry-run and rejects mixed or unknown flags', () => {
  assert.equal(catalog20261112AuditFixesSeedOptions([]).apply, false);
  assert.equal(catalog20261112AuditFixesSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261112AuditFixesSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force'], ['--apply=true']]) {
    assert.throws(() => catalog20261112AuditFixesSeedOptions(args), /Usage/);
  }
});

test('Gemini Decision 1 is a sourced input-only decision catalog entry', () => {
  const item = catalogForKind('decision-model').find(i => i.slug === GEMINI_DECISION_SPEC.slug)!;
  assert.equal(item, GEMINI_DECISION_1);
  assert.equal(item.provider, 'Google');
  assert.equal(item.providerSlug, 'google');
  assert.equal(item.modelCategory, 'decision');
  assert.equal(item.status, 'available');
  assert.deepEqual([item.inputPricePer1M, item.outputPricePer1M, item.pricePer1MTasks], [0.10, 0, null]);
  assert.equal(item.contextWindow, 262_144);
  assert.deepEqual(item.inputModalities, ['text', 'image', 'video', 'audio']);
  assert.deepEqual(item.outputModalities, ['text']);
  assert.equal(item.releasedAt, '2026-11-11');
  assert.equal(item.lastVerified, '2026-11-12');
  assert.equal(item.deferredDbSeedScript, 'seed:catalog-2026-11-12-audit-fixes:apply');
  assert.match(item.notes!, /PDF/);
  assert.match(item.notes!, /no pdf member/);
  assert.match(item.notes!, /Batch API is not supported/);
  assert.equal(item.sourceUrls?.[0].url, GEMINI_DECISION_SPEC.officialPage);
  assert.ok(item.sourceUrls?.some(source => source.url === GEMINI_DECISION_SPEC.vercelModels));
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items: [item], locale }));
    assert.ok(html.includes(`/${locale}/decision-models/${GEMINI_DECISION_SPEC.slug}`));
    assert.ok(html.includes('0.1'));
  }
});

test('free-output exemption is limited to this model on official and Vercel channels at $0.10', () => {
  for (const channel of ['google', 'vercel-ai-gateway', 'vercel']) {
    assert.equal(isVerifiedFreeOutput(GEMINI_DECISION_SPEC.slug, channel, 0.10), true);
    assert.equal(isVerifiedFreeOutput(GEMINI_DECISION_SPEC.slug, channel, 0), false);
    assert.equal(isVerifiedFreePrice(GEMINI_DECISION_SPEC.slug, channel), false);
  }
  assert.equal(isVerifiedFreeOutput(GEMINI_DECISION_SPEC.slug, 'openrouter', 0.10), false);
  assert.equal(isVerifiedFreeOutput('morph-reflex', 'google', 0.10), false);
});

test('production-shaped dry-run inserts the model and two channels, then is idle', async () => {
  const f = base();
  const steps = await seedCatalog20261112AuditFixes(f.tx, true);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  const model = f.data.models.find(row => row.slug === GEMINI_DECISION_SPEC.slug)!;
  assert.equal(model.model_category, 'decision');
  assert.equal(model.context_window, 262_144);
  assert.equal(model.max_output_tokens, 0);
  assert.deepEqual(model.input_modalities, ['text', 'image', 'video', 'audio']);
  const official = f.data.api_channel_prices.find(row => row.model_id === model.id && row.provider_id === google.id)!;
  const gateway = f.data.api_channel_prices.find(row => row.model_id === model.id && row.provider_id === vercel.id)!;
  assert.equal(official.input_price_per_1m, 0.10);
  assert.equal(official.output_price_per_1m, 0);
  assert.equal(official.cached_input_price_per_1m, null);
  assert.equal(gateway.input_price_per_1m, 0.10);
  assert.equal(gateway.output_price_per_1m, 0);
  const again = await seedCatalog20261112AuditFixes(f.tx, true);
  assert.deepEqual(again.filter(step => step.action !== 'skip'), []);
});

test('existing alias row is updated in place; both slugs together fail', async () => {
  const alias = fakeSeedTx({
    providers: [google, vercel],
    models: [{ id: 40, slug: 'google-gemini-decision-1', name: 'old', type: 'llm', provider_ids: [7] }],
  });
  const steps = await seedCatalog20261112AuditFixes(alias.tx, true);
  assert.equal(steps.find(step => step.table === 'models')?.action, 'update');
  assert.equal(alias.data.models[0].slug, GEMINI_DECISION_SPEC.slug);
  assert.equal(alias.data.models.length, 1);

  const both = fakeSeedTx({
    providers: [google, vercel],
    models: [
      { id: 41, slug: GEMINI_DECISION_SPEC.slug, type: 'llm', provider_ids: [7] },
      { id: 42, slug: 'google-gemini-decision-1', type: 'llm', provider_ids: [7] },
    ],
  });
  await assert.rejects(() => seedCatalog20261112AuditFixes(both.tx, true), /Both gemini-decision-1 and google-gemini-decision-1/);
  assert.equal(both.writes(), 0);
});

test('fresher official channel is left alone; missing Vercel provider skips only that channel', async () => {
  const model = { id: 50, slug: GEMINI_DECISION_SPEC.slug, type: 'llm', model_category: 'decision', provider_ids: [7] };
  const fresh = fakeSeedTx({
    providers: [google, vercel],
    models: [model],
    api_channel_prices: [{
      id: 60, model_id: 50, provider_id: 7, input_price_per_1m: 0.2, output_price_per_1m: 0,
      last_verified: new Date('2026-11-13T00:00:00Z'), notes: 'keep',
    }],
  });
  const steps = await seedCatalog20261112AuditFixes(fresh.tx, true);
  assert.ok(!steps.some(step => step.target === `google/${GEMINI_DECISION_SPEC.slug}` && step.action !== 'skip'));
  assert.equal(fresh.data.api_channel_prices.find(row => row.id === 60)?.input_price_per_1m, 0.2);
  assert.ok(steps.some(step => step.target === `vercel-ai-gateway/${GEMINI_DECISION_SPEC.slug}` && step.action === 'insert'));

  const officialOnly = fakeSeedTx({ providers: [google], models: [] });
  const skipped = await seedCatalog20261112AuditFixes(officialOnly.tx, true);
  assert.equal(seedStepCounts(skipped).models.insert, 1);
  assert.equal(seedStepCounts(skipped).api_channel_prices.insert, 1);
  const skip = skipped.find(step => step.action === 'skip')!;
  assert.match(skip.reason ?? '', /vercel/);
});

test('wrong provider types or a missing google provider write nothing', async () => {
  for (const initial of [
    { providers: [{ ...google, type: 'aggregator' }, vercel], models: [] },
    { providers: [google, { ...vercel, type: 'official' }], models: [] },
    { providers: [vercel], models: [] },
  ]) {
    const f = fakeSeedTx(initial);
    await assert.rejects(() => seedCatalog20261112AuditFixes(f.tx, true), /nothing written/);
    assert.equal(f.writes(), 0);
  }
});

test('manual seed is wired and is not part of deploy or seed-catalog.sh', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-12-audit-fixes'], 'tsx scripts/seed-catalog-2026-11-12-audit-fixes.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-12-audit-fixes:apply'], 'tsx scripts/seed-catalog-2026-11-12-audit-fixes.ts --apply');
  for (const file of [
    '../../deploy/production/rollout.sh',
    '../../deploy/production/run-scrapers.sh',
    '../../.github/workflows/deploy-production.yml',
    '../../scripts/seed-catalog.sh',
  ]) {
    const path = new URL(file, import.meta.url);
    try {
      assert.doesNotMatch(readFileSync(path, 'utf8'), /2026-11-12-audit-fixes/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
});
