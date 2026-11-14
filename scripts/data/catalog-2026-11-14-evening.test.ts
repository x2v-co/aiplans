import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEEPINFRA_SLUG, INKLING_CURRENT, INKLING_DEEPINFRA_NOTES, INKLING_REGULAR, INKLING_SLUG,
  PRODUCTION_SHAPED_DRY_RUN, VERIFIED_AT, catalog20261114EveningSeedOptions, seedCatalog20261114Evening, seedStepCounts,
} from './catalog-2026-11-14-evening';

test('seed options accept only --dry-run or --apply', () => {
  assert.deepEqual(catalog20261114EveningSeedOptions([]), { apply: false });
  assert.deepEqual(catalog20261114EveningSeedOptions(['--dry-run']), { apply: false });
  assert.deepEqual(catalog20261114EveningSeedOptions(['--apply']), { apply: true });
  assert.throws(() => catalog20261114EveningSeedOptions(['--apply', '--dry-run']));
  assert.throws(() => catalog20261114EveningSeedOptions(['--force']));
});

test('DeepInfra Inkling 2 Small prices match the official page and API payload', () => {
  assert.deepEqual(INKLING_REGULAR, { input: 0.3, output: 1, cached: 0.03 });
  assert.deepEqual(INKLING_CURRENT, { input: 0.285, output: 0.95, cached: 0.0285 });
  assert.match(INKLING_DEEPINFRA_NOTES, /5% off/);
  assert.match(INKLING_DEEPINFRA_NOTES, /discount_ends_at null/);
  assert.match(INKLING_DEEPINFRA_NOTES, /rounds it to \$0\.028/);
});

test('package.json registers the dry-run and apply scripts, not deploy', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-14-evening'], 'tsx scripts/seed-catalog-2026-11-14-evening.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-14-evening:apply'], 'tsx scripts/seed-catalog-2026-11-14-evening.ts --apply');
  assert.ok(pkg.scripts['test:db'].includes('catalog-2026-11-14-evening-postgres.test.ts'));
  const deploy = JSON.stringify(pkg.scripts.deploy ?? '') + JSON.stringify(pkg.scripts['seed-catalog'] ?? '');
  assert.ok(!deploy.includes('2026-11-14-evening'));
});

type Row = Record<string, unknown> & { id: number };
function memory() {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [] };
  let next = 1;
  const sql = (first: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    if (!Array.isArray(first) || !Object.prototype.hasOwnProperty.call(first, 'raw')) return first;
    const text = (first as TemplateStringsArray).join('?');
    if (text.includes('FROM models WHERE slug =')) return data.models.filter(row => row.slug === values[0]);
    if (text.includes('FROM providers WHERE slug IN')) {
      const slugs = new Set(values[0] as string[]);
      return data.providers.filter(row => slugs.has(String(row.slug)));
    }
    if (text.includes('FROM api_channel_prices')) {
      return data.api_channel_prices.filter(row => row.model_id === values[0] && row.provider_id === values[1]);
    }
    throw new Error(`unexpected query: ${text}`);
  };
  const insert = (table: string, row: Omit<Row, 'id'>) => {
    const saved = { ...row, id: next++ } as Row;
    data[table].push(saved);
    return saved;
  };
  return { data, sql, insert };
}

test('production-shaped dry-run matches the published shape', async () => {
  const db = memory();
  db.insert('models', { slug: INKLING_SLUG, name: 'Inkling 2 Small' });
  const steps = await seedCatalog20261114Evening(db.sql as never, false);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  const channel = steps.find(step => step.table === 'api_channel_prices')!;
  assert.equal(channel.target, `${DEEPINFRA_SLUG}/${INKLING_SLUG}`);
  assert.equal(channel.changes.input_price_per_1m.to, 0.285);
  assert.equal(channel.changes.regular_output_price_per_1m.to, 1);
  assert.equal(channel.changes.promo_ends_at.to, null);
});

test('an existing DeepInfra provider is reused, an up-to-date channel is a no-op, and a newer row is kept', async () => {
  const db = memory();
  const model = db.insert('models', { slug: INKLING_SLUG, name: 'Inkling 2 Small' });
  const provider = db.insert('providers', { slug: DEEPINFRA_SLUG, name: 'DeepInfra', type: 'aggregator' });
  db.insert('api_channel_prices', {
    model_id: model.id, provider_id: provider.id, input_price_per_1m: 0.3, output_price_per_1m: 1,
    cached_input_price_per_1m: 0.03, last_verified: new Date('2026-11-01T00:00:00Z'),
  });
  const steps = await seedCatalog20261114Evening(db.sql as never, false);
  assert.deepEqual(seedStepCounts(steps), { providers: { insert: 0, update: 0 }, api_channel_prices: { insert: 0, update: 1 } });
  db.data.api_channel_prices[0].last_verified = new Date(VERIFIED_AT.getTime() + 86_400_000);
  assert.deepEqual(await seedCatalog20261114Evening(db.sql as never, false), []);
});

test('missing Inkling model is skipped, not created; wrong provider type aborts', async () => {
  const empty = memory();
  const steps = await seedCatalog20261114Evening(empty.sql as never, false);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, 'skip');
  const db = memory();
  db.insert('models', { slug: INKLING_SLUG, name: 'Inkling 2 Small' });
  db.insert('providers', { slug: DEEPINFRA_SLUG, name: 'DeepInfra', type: 'producer' });
  await assert.rejects(seedCatalog20261114Evening(db.sql as never, false), /type producer/);
});
