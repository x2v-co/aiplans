import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PRODUCTION_SHAPED_DRY_RUN, QWEN35_MODELS, QWEN35_SHUTDOWN_DATE, VERIFIED_AT,
  catalog20261115IntelSeedOptions, qwen35Notice, seedCatalog20261115Intel, seedStepCounts,
} from './catalog-2026-11-15-intel';

test('seed options accept only --dry-run or --apply', () => {
  assert.deepEqual(catalog20261115IntelSeedOptions([]), { apply: false });
  assert.deepEqual(catalog20261115IntelSeedOptions(['--apply']), { apply: true });
  assert.throws(() => catalog20261115IntelSeedOptions(['--apply', '--dry-run']));
  assert.throws(() => catalog20261115IntelSeedOptions(['--force']));
});

test('Qwen3.5 notice matches the official deprecation page', () => {
  assert.equal(QWEN35_SHUTDOWN_DATE, '2027-01-19');
  assert.deepEqual(QWEN35_MODELS.map(spec => [spec.apiId, spec.input, spec.output]), [
    ['qwen3.5-plus', 0.8, 4.8], ['qwen3.5-plus-2026-02-15', 0.8, 4.8],
    ['qwen3.5-plus-2026-04-20', 0.8, 4.8], ['qwen3.5-397b-a17b', 1.2, 7.2],
  ]);
  const note = qwen35Notice(QWEN35_MODELS[3]);
  assert.match(note, /new purchases stop 2026-11-18/);
  assert.match(note, /2027-01-19 10:00 Beijing time/);
  assert.match(note, /qwen3\.8-flash \(¥0\.8 \/ ¥2\.7\)/);
});

test('package.json registers the dry-run and apply scripts, not deploy', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['seed:catalog-2026-11-15-intel'], 'tsx scripts/seed-catalog-2026-11-15-intel.ts');
  assert.equal(pkg.scripts['seed:catalog-2026-11-15-intel:apply'], 'tsx scripts/seed-catalog-2026-11-15-intel.ts --apply');
  assert.ok(pkg.scripts['test:db'].includes('catalog-2026-11-15-intel-postgres.test.ts'));
  const deploy = JSON.stringify(pkg.scripts.deploy ?? '') + JSON.stringify(pkg.scripts['seed-catalog'] ?? '');
  assert.ok(!deploy.includes('2026-11-15-intel'));
});

type Row = Record<string, unknown> & { id: number };
function memory() {
  const data: Record<string, Row[]> = { providers: [], models: [], api_channel_prices: [] };
  let next = 1;
  const sql = (first: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    if (!Array.isArray(first) || !Object.prototype.hasOwnProperty.call(first, 'raw')) return first;
    const text = (first as TemplateStringsArray).join('?');
    if (text.includes('FROM models WHERE slug IN')) return data.models.filter(row => (values[0] as string[]).includes(String(row.slug)));
    if (text.includes('FROM providers WHERE slug IN')) return data.providers.filter(row => (values[0] as string[]).includes(String(row.slug)));
    if (text.includes('FROM api_channel_prices WHERE model_id')) return data.api_channel_prices.filter(row => row.model_id === values[0]);
    throw new Error(`unexpected query: ${text}`);
  };
  const insert = (table: string, row: Omit<Row, 'id'>) => {
    const saved = { ...row, id: next++ } as Row;
    data[table].push(saved);
    return saved;
  };
  return { data, sql, insert };
}

function productionShaped() {
  const db = memory();
  const qwen = db.insert('providers', { slug: 'qwen', name: 'Qwen' });
  const openrouter = db.insert('providers', { slug: 'openrouter', name: 'OpenRouter' });
  const deepinfra = db.insert('providers', { slug: 'deepinfra', name: 'DeepInfra' });
  const plus = db.insert('models', { slug: 'qwen3.5-plus', name: 'qwen3.5-plus', shutdown_date: null, description: 'Qwen3.5 Plus.' });
  const s0215 = db.insert('models', { slug: 'qwen-qwen3-5-plus-02-15', name: 'qwen3.5-plus-2026-02-15', shutdown_date: null });
  const s0420 = db.insert('models', { slug: 'qwen-qwen3-5-plus-20260420', name: 'qwen3.5-plus-2026-04-20', shutdown_date: null });
  const big = db.insert('models', { slug: 'qwen3.5-397b-a17b', name: 'qwen3.5-397b-a17b', shutdown_date: null });
  db.insert('api_channel_prices', { model_id: plus.id, provider_id: qwen.id, notes: null, last_verified: new Date('2026-11-14T00:00:00Z') });
  db.insert('api_channel_prices', { model_id: s0215.id, provider_id: openrouter.id, notes: null });
  db.insert('api_channel_prices', { model_id: s0420.id, provider_id: openrouter.id, notes: null });
  db.insert('api_channel_prices', { model_id: big.id, provider_id: qwen.id, notes: 'Official.', last_verified: new Date('2026-11-14T00:00:00Z') });
  db.insert('api_channel_prices', { model_id: big.id, provider_id: openrouter.id, notes: null });
  return { db, deepinfra, plus, big };
}

test('production-shaped dry-run matches the published shape and leaves the shared 397b row alone', async () => {
  const { db } = productionShaped();
  const steps = await seedCatalog20261115Intel(db.sql as never, false);
  assert.deepEqual(seedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(steps.filter(step => step.action === 'skip').length, 0);
  const plus = steps.find(step => step.target === 'qwen3.5-plus')!;
  assert.equal(plus.changes.shutdown_date.to, '2027-01-19');
  assert.equal(plus.changes.replacement_model.to, 'qwen3.8-flash');
  assert.equal(plus.changes.deprecated_at.to, '2026-10-19');
  assert.ok(!steps.some(step => step.table === 'models' && step.target === 'qwen3.5-397b-a17b'));
  assert.match(String(steps.find(step => step.target === 'qwen/qwen3.5-397b-a17b')!.changes.notes.to), /^Official\.\nQwen Model Studio qwen3\.5-397b-a17b/);
});

test('a model with a non-Alibaba channel or a different shutdown date is skipped; a newer channel is kept', async () => {
  const { db, deepinfra, plus, big } = productionShaped();
  db.insert('api_channel_prices', { model_id: plus.id, provider_id: deepinfra.id });
  db.data.models.find(row => row.slug === 'qwen-qwen3-5-plus-02-15')!.shutdown_date = '2026-12-01';
  db.data.api_channel_prices.find(row => row.model_id === big.id && row.notes === 'Official.')!.last_verified = new Date(VERIFIED_AT.getTime() + 86_400_000);
  const steps = await seedCatalog20261115Intel(db.sql as never, false);
  assert.match(steps.find(step => step.target === 'qwen3.5-plus')!.reason!, /non-Alibaba/);
  assert.match(steps.find(step => step.target === 'qwen-qwen3-5-plus-02-15')!.reason!, /already has shutdown_date 2026-12-01/);
  assert.deepEqual(seedStepCounts(steps), { models: { insert: 0, update: 1 }, api_channel_prices: { insert: 0, update: 0 } });
});

test('missing models are skipped, not created', async () => {
  const db = memory();
  const steps = await seedCatalog20261115Intel(db.sql as never, false);
  assert.equal(steps.length, 4);
  assert.ok(steps.every(step => step.action === 'skip'));
});
