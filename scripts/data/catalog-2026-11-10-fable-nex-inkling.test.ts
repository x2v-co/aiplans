import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FABLE_BATCH_NOTES, FABLE_BATCH_PRICE, FABLE_BATCH_SLUG, FABLE_CONTEXT, FABLE_MAX_OUTPUT, FABLE_STANDARD_PRICE,
  INKLING_FREE_CONTEXT, INKLING_FREE_NOTES, INKLING_FREE_SLUG, INKLING_PAID_SLUG, LATEST_CANONICAL, LATEST_NOTES,
  LATEST_SHORT, NEX_CONTEXT, NEX_NOTES, NEX_PRICE, NEX_SLUG, PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT,
  catalog20261110FableNexInklingSeedOptions, seedCatalog20261110FableNexInkling, seedStepCounts,
} from './catalog-2026-11-10-fable-nex-inkling';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { isOpenRouterPublishedFree } from '../utils/audit-price-policy';
import { checkModelIdentity } from '../utils/model-identity-guard';
import { generateOpenRouterSlug } from '../scrapers/openrouter';

const anthropic = { id: 1, slug: 'anthropic', name: 'Anthropic', type: 'official' };
const openrouter = { id: 9, slug: 'openrouter', name: 'OpenRouter', type: 'aggregator' };
const thinkingmachines = { id: 8, slug: 'thinkingmachines', name: 'thinkingmachines', type: 'official' };
const paidInkling = {
  id: 60, slug: INKLING_PAID_SLUG, provider_ids: [8], name: 'Inkling 2 Small', context_window: 262144,
  description: 'Paid Tinker row.', parameters: '594B',
};
const latestModel = {
  id: 50, slug: LATEST_CANONICAL, provider_ids: [1], name: 'Claude Fable Latest', description: 'Routes to the latest Fable.',
};
const latestChannel = {
  id: 80, model_id: 50, provider_id: 9, input_price_per_1m: 10, output_price_per_1m: 50, cached_input_price_per_1m: 0.25,
  currency: 'USD', price_unit: 'per_1m_tokens', is_available: true, last_verified: new Date('2026-11-01T00:00:00Z'),
  notes: 'Fable 5.1 standard rate', promo_ends_at: null,
  regular_input_price_per_1m: null, regular_output_price_per_1m: null, regular_cached_input_price_per_1m: null,
};

function shaped(extra: { providers?: FakeRow[]; models?: FakeRow[]; api_channel_prices?: FakeRow[] } = {}) {
  return fakeSeedTx({
    providers: extra.providers ?? [anthropic, openrouter, thinkingmachines],
    models: extra.models ?? [paidInkling, latestModel],
    api_channel_prices: extra.api_channel_prices ?? [latestChannel],
  });
}

test('CLI defaults to dry-run, :apply is separate, and rehearsal is the write path', () => {
  assert.equal(catalog20261110FableNexInklingSeedOptions([]).apply, false);
  assert.equal(catalog20261110FableNexInklingSeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261110FableNexInklingSeedOptions(['--apply']).apply, true);
  for (const args of [['--force'], ['--dry-run', '--apply']]) assert.throws(() => catalog20261110FableNexInklingSeedOptions(args), /Usage/);
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['seed:catalog-2026-11-10-fable-nex-inkling'], 'tsx scripts/seed-catalog-2026-11-10-fable-nex-inkling.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-10-fable-nex-inkling:apply'], 'tsx scripts/seed-catalog-2026-11-10-fable-nex-inkling.ts --apply');
  const cli = readFileSync(new URL('../seed-catalog-2026-11-10-fable-nex-inkling.ts', import.meta.url), 'utf8');
  assert.match(cli, /runRehearsable/);
  assert.doesNotMatch(cli, /READ ONLY/);
  const source = readFileSync(new URL('./catalog-2026-11-10-fable-nex-inkling.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /lfm-3-1\.7b|humansand-ampersand|workers-ai/);
  for (const file of ['../../deploy/production/rollout.sh', '../../deploy/production/seed-catalog.sh', '../../.github/workflows/deploy-production.yml', '../../.github/workflows/seed-catalog.yml']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /2026-11-10-fable-nex-inkling/);
  }
});

test('published prices, slugs and explicit NULLs match the cited pages', () => {
  assert.equal(generateOpenRouterSlug('anthropic/claude-fable-5.2:batch'), FABLE_BATCH_SLUG);
  assert.equal(generateOpenRouterSlug('~anthropic/claude-fable-latest'), LATEST_CANONICAL);
  assert.equal(generateOpenRouterSlug('nex-agi/nex-n2.6'), NEX_SLUG);
  assert.equal(generateOpenRouterSlug('thinkingmachines/inkling-2-small:free'), INKLING_FREE_SLUG);
  assert.deepEqual([FABLE_BATCH_PRICE.input, FABLE_BATCH_PRICE.output, FABLE_BATCH_PRICE.cache], [4, 20, 0.1]);
  assert.deepEqual([FABLE_STANDARD_PRICE.input, FABLE_STANDARD_PRICE.output, FABLE_STANDARD_PRICE.cache], [8, 40, 0.2]);
  assert.deepEqual([NEX_PRICE.input, NEX_PRICE.output, NEX_PRICE.cache], [0.12, 0.4, 0.024]);
  assert.equal(FABLE_CONTEXT, 1_000_000);
  assert.equal(FABLE_MAX_OUTPUT, 128_000);
  assert.equal(NEX_CONTEXT, 262_144);
  assert.equal(INKLING_FREE_CONTEXT, 1_048_576);
  assert.equal(VERIFIED_AT.toISOString(), '2026-11-10T00:00:00.000Z');
  assert.match(FABLE_BATCH_NOTES, /\$4 \/ \$20 \/ \$0\.10/);
  assert.match(FABLE_BATCH_NOTES, /No Anthropic producer channel/);
  assert.match(LATEST_NOTES, /\$8 \/ \$40 \/ \$0\.20/);
  assert.match(LATEST_NOTES, /\$10 \/ \$50/);
  assert.match(NEX_NOTES, /\$0\.12 \/ \$0\.40 \/ \$0\.024/);
  assert.match(NEX_NOTES, /discount field is not applied a second time/);
  assert.match(INKLING_FREE_NOTES, /cached_input_price_per_1m is NULL/);
  assert.equal(checkModelIdentity('Claude Fable 5.2 (batch)', FABLE_BATCH_SLUG).ok, true);
  assert.equal(checkModelIdentity('Claude Fable Latest', LATEST_CANONICAL).ok, true);
  assert.equal(checkModelIdentity('Nex-N2.6', NEX_SLUG).ok, true);
  assert.equal(checkModelIdentity('Inkling 2 Small (free)', INKLING_FREE_SLUG).ok, true);
  assert.equal(isOpenRouterPublishedFree('openrouter', 0, 0), true);
});

test('production-shaped dry-run previews one provider, three models, three price inserts and one alias update', async () => {
  const f = shaped();
  const before = structuredClone(f.data);
  const steps = await seedCatalog20261110FableNexInkling(f.tx);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.data, before);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.deepEqual(steps.map(step => `${step.action} ${step.table} ${step.target}`), [
    'insert providers nex-agi',
    `insert models ${FABLE_BATCH_SLUG}`,
    `insert models ${NEX_SLUG}`,
    `insert models ${INKLING_FREE_SLUG}`,
    `insert api_channel_prices openrouter/${FABLE_BATCH_SLUG}`,
    `update api_channel_prices openrouter/${LATEST_CANONICAL}`,
    `insert api_channel_prices openrouter/${NEX_SLUG}`,
    `insert api_channel_prices openrouter/${INKLING_FREE_SLUG}`,
  ]);
  assert.ok(steps.every(step => step.target !== INKLING_PAID_SLUG && !step.target.endsWith(`/${INKLING_PAID_SLUG}`)));
  const batch = steps.find(step => step.target === `openrouter/${FABLE_BATCH_SLUG}`)!;
  assert.deepEqual([
    batch.changes.input_price_per_1m.to, batch.changes.output_price_per_1m.to, batch.changes.cached_input_price_per_1m.to,
  ], [4, 20, 0.1]);
  assert.equal(batch.changes.model_id.to, -2);
  assert.ok(!('data_for_discount' in batch.changes));
  const alias = steps.find(step => step.target === `openrouter/${LATEST_CANONICAL}`)!;
  assert.equal(alias.changes.input_price_per_1m.from, 10);
  assert.equal(alias.changes.input_price_per_1m.to, 8);
  assert.equal(alias.changes.output_price_per_1m.from, 50);
  assert.equal(alias.changes.output_price_per_1m.to, 40);
  assert.equal(alias.changes.cached_input_price_per_1m.from, 0.25);
  assert.equal(alias.changes.cached_input_price_per_1m.to, 0.2);
  const nex = steps.find(step => step.target === NEX_SLUG)!;
  assert.equal(nex.changes.context_window.to, NEX_CONTEXT);
  assert.equal(nex.changes.parameters.to, null);
  assert.ok(!('max_output_tokens' in nex.changes));
  const free = steps.find(step => step.target === `openrouter/${INKLING_FREE_SLUG}`)!;
  assert.equal(free.changes.input_price_per_1m.to, 0);
  assert.equal(free.changes.output_price_per_1m.to, 0);
  assert.equal(free.changes.cached_input_price_per_1m.to, null);
  const freeModel = steps.find(step => step.target === INKLING_FREE_SLUG)!;
  assert.equal(freeModel.changes.context_window.to, INKLING_FREE_CONTEXT);
  assert.ok(!('max_output_tokens' in freeModel.changes));
});

test('apply is idempotent and does not rewrite the paid Inkling row or an existing Nex provider', async () => {
  const nex = { id: 7, slug: 'nex-agi', name: 'Nex AGI', type: 'producer', website: 'https://kept.example/nex', notes: 'audit identity' };
  const f = shaped({ providers: [anthropic, openrouter, thinkingmachines, nex] });
  const paidBefore = structuredClone(f.data.models.find(row => row.slug === INKLING_PAID_SLUG));
  await seedCatalog20261110FableNexInkling(f.tx, true);
  assert.deepEqual(f.data.models.find(row => row.slug === INKLING_PAID_SLUG), paidBefore);
  assert.equal(f.data.providers.find(row => row.slug === 'nex-agi')!.website, 'https://kept.example/nex');
  assert.equal(f.data.providers.find(row => row.slug === 'nex-agi')!.notes, 'audit identity');
  assert.equal(f.data.models.filter(row => row.slug === FABLE_BATCH_SLUG).length, 1);
  assert.equal(f.data.api_channel_prices.filter(row => row.provider_id === anthropic.id).length, 0);
  const alias = f.data.api_channel_prices.find(row => row.model_id === latestModel.id)!;
  assert.equal(alias.input_price_per_1m, 8);
  assert.equal(alias.output_price_per_1m, 40);
  assert.equal(alias.cached_input_price_per_1m, 0.2);
  assert.equal(f.data.models.find(row => row.slug === LATEST_CANONICAL)!.description, 'Routes to the latest Fable.');
  assert.deepEqual(await seedCatalog20261110FableNexInkling(f.tx, true), []);
});

test('the short latest slug is updated in place and a newer verification keeps $10/$50', async () => {
  const f = shaped({
    models: [paidInkling, { ...latestModel, slug: LATEST_SHORT }],
  });
  const steps = await seedCatalog20261110FableNexInkling(f.tx, true);
  assert.ok(steps.some(step => step.target === `openrouter/${LATEST_SHORT}` && step.action === 'update'));
  assert.equal(f.data.models.filter(row => String(row.slug).includes('fable-latest')).length, 1);
  assert.equal(f.data.models.find(row => row.slug === LATEST_SHORT)!.slug, LATEST_SHORT);
  const row = f.data.api_channel_prices.find(price => price.model_id === latestModel.id)!;
  Object.assign(row, {
    input_price_per_1m: 10, output_price_per_1m: 50, cached_input_price_per_1m: 0.25,
    last_verified: new Date('2026-11-10T18:00:00Z'), notes: 'Newer scrape',
  });
  const before = structuredClone(row);
  await seedCatalog20261110FableNexInkling(f.tx, true);
  assert.deepEqual(row, before);
});

test('a locked-off channel stays unavailable', async () => {
  const f = shaped();
  await seedCatalog20261110FableNexInkling(f.tx, true);
  const row = f.data.api_channel_prices.find(price => price.input_price_per_1m === 0)!;
  Object.assign(row, { is_available: false, availability_locked: true, last_verified: new Date('2026-11-01T00:00:00Z') });
  await seedCatalog20261110FableNexInkling(f.tx, true);
  assert.equal(row.is_available, false);
  assert.equal(row.input_price_per_1m, 0);
});

test('missing providers, the wrong type, duplicates or a non-canonical slug abort with nothing written', async () => {
  const cases = [
    { providers: [openrouter, thinkingmachines], models: [paidInkling, latestModel] },
    { providers: [anthropic, thinkingmachines], models: [paidInkling, latestModel] },
    { providers: [anthropic, openrouter], models: [paidInkling, latestModel] },
    { providers: [anthropic, { ...openrouter, type: 'official' }, thinkingmachines], models: [paidInkling, latestModel] },
    { providers: [{ ...anthropic, type: 'reseller' }, openrouter, thinkingmachines], models: [paidInkling, latestModel] },
    { providers: [anthropic, openrouter, { ...thinkingmachines, type: 'aggregator' }], models: [paidInkling, latestModel] },
    { providers: [anthropic, openrouter, thinkingmachines, { id: 7, slug: 'nex-agi', type: 'reseller' }], models: [paidInkling, latestModel] },
    { providers: [anthropic, openrouter, thinkingmachines], models: [paidInkling, latestModel, { id: 70, slug: LATEST_SHORT }] },
    { providers: [anthropic, openrouter, thinkingmachines], models: [paidInkling, latestModel, { id: 71, slug: 'claude-fable-5.2-batch' }] },
    { providers: [anthropic, openrouter, thinkingmachines], models: [paidInkling, latestModel, { id: 72, slug: 'nex-n2.6' }] },
    { providers: [anthropic, openrouter, thinkingmachines], models: [paidInkling, latestModel, { id: 73, slug: 'inkling-2-small-free' }] },
  ];
  for (const initial of cases) {
    const f = fakeSeedTx({ ...initial, api_channel_prices: [latestChannel] });
    await assert.rejects(() => seedCatalog20261110FableNexInkling(f.tx, true), /nothing written/i);
    assert.equal(f.writes(), 0);
  }
});
