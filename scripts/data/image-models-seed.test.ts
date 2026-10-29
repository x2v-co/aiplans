import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { spawnSync } from 'node:child_process';
import { seedImageModels } from './non-llm-seed';
import { IMAGE_MODEL_CATALOG } from '../../src/lib/image-model-catalog';

type Row = Record<string, unknown> & { id: number };
/** Only these three SQL shapes are accepted. No DB client is imported. */
function fixture(initial: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { providers: [], models: [], plans: [], model_plan_mapping: [], usage_prices: [], ...structuredClone(initial) };
  let nextId = 1000;
  let writes = 0;
  const tx = (parts: TemplateStringsArray | unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(parts) || !('raw' in parts)) return { fragment: parts };
    const query = parts.join('?').trim();
    const fragment = (value: unknown) => (value as { fragment: unknown }).fragment;
    const table = String(fragment(values[0]));
    assert.ok(Object.hasOwn(data, table), `Unexpected table: ${table}`);
    if (query === 'SELECT * FROM ?') return Promise.resolve(structuredClone(data[table]));
    if (query === 'INSERT INTO ? ? RETURNING id') {
      const row = { ...fragment(values[1]) as Record<string, unknown>, id: nextId++ };
      data[table].push(row); writes++;
      return Promise.resolve([{ id: row.id }]);
    }
    if (query === 'UPDATE ? SET ? WHERE id = ?') {
      const row = data[table].find(row => row.id === values[2]);
      assert.ok(row); Object.assign(row, fragment(values[1])); writes++;
      return Promise.resolve([]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  return { tx: tx as unknown as Sql, data, writeCount: () => writes };
}

test('image catalog: every row is official-sourced, itemized and has a headline price', () => {
  const slugs = new Set<string>();
  for (const item of IMAGE_MODEL_CATALOG) {
    assert.equal(item.kind, 'image-model');
    assert.ok(!slugs.has(item.slug!), `duplicate ${item.slug}`); slugs.add(item.slug!);
    assert.ok(item.sourceUrls?.length && item.sourceUrls.every(s => /^https:\/\//.test(s.url)), item.slug);
    assert.ok(item.usageRates?.length && item.usageRates.every(r => typeof r.price === 'number' && r.price >= 0), item.slug);
    assert.ok(!item.usageRates!.some(r => r.priceKind === 'availability'), item.slug);
    assert.equal(typeof item.pricePerUnit, 'number', item.slug);
    assert.ok(item.usageRates!.some(r => r.price === item.pricePerUnit), `${item.slug} headline must be one of its rates`);
  }
  for (const slug of ['gemini-nano-banana-2.1', 'gemini-3-pro-image', 'imagen-4', 'gpt-image-2', 'gpt-image-1-mini']) assert.ok(slugs.has(slug), slug);
  const lifecycle = (slug: string) => IMAGE_MODEL_CATALOG.find(i => i.slug === slug)!;
  assert.equal(lifecycle('gemini-2.5-flash-image').status, 'deprecated');
  assert.equal(lifecycle('gemini-2.5-flash-image').shutdownDate, '2027-03-15');
  assert.equal(lifecycle('gemini-2.5-flash-image').replacementModel, 'gemini-3.1-flash-lite-image');
  assert.equal(lifecycle('gpt-image-1').shutdownDate, '2026-10-23');
  assert.equal(lifecycle('gpt-image-1.5').shutdownDate, '2026-12-01');
  assert.equal(lifecycle('gpt-image-1-mini').shutdownDate, '2026-12-01');
  assert.equal(lifecycle('grok-imagine-image-quality').shutdownDate, '2026-11-02');
  assert.equal(lifecycle('grok-imagine-image-quality').pricePerUnit, 0.05);
});

test('image seed: dry-run is read-only, reuses existing LLM rows/providers and is idempotent', async () => {
  const f = fixture({
    providers: [{ id: 1, slug: 'google' }, { id: 2, slug: 'openai' }, { id: 3, slug: 'vertex-ai' },
      { id: 4, slug: 'bfl' }, { id: 5, slug: 'volcengine' }, { id: 6, slug: 'qwen' }, { id: 7, slug: 'xai' }],
    models: [{ id: 3364, slug: 'gemini-nano-banana-2.1', name: 'Gemini Nano Banana 2.1', type: 'llm', description: 'LLM scraper row', provider_ids: [1] }],
    usage_prices: [],
  });
  const before = structuredClone(f.data);
  const preview = await seedImageModels(f.tx);
  assert.deepEqual(f.data, before);
  assert.equal(f.writeCount(), 0);
  assert.deepEqual(preview.filter(s => s.table === 'providers').map(s => JSON.stringify(s)).filter(s => /recraft|ideogram/.test(s)).length, 2);
  assert.equal(preview.filter(s => s.table === 'providers').length, 2);
  await seedImageModels(f.tx, true);
  const nano = f.data.models.filter(row => row.slug === 'gemini-nano-banana-2.1');
  assert.equal(nano.length, 1);
  assert.equal(nano[0].name, 'Gemini Nano Banana 2.1');
  assert.equal(nano[0].type, 'llm');
  assert.equal(nano[0].description, 'LLM scraper row');
  assert.equal(nano[0].model_category, 'image');
  assert.equal(f.data.providers.length, 9);
  const flux = f.data.models.find(row => row.slug === 'flux-2-pro')!;
  assert.ok(f.data.usage_prices.filter(row => row.model_id === flux.id).every(row => row.provider_id === 4 && row.unit === 'megapixel'));
  const seed = f.data.models.find(row => row.slug === 'seedream-4-5')!;
  assert.ok(f.data.usage_prices.some(row => row.model_id === seed.id && row.provider_id === 5 && row.price === 0.04));
  const imagen = f.data.models.find(row => row.slug === 'imagen-4')!;
  assert.ok(f.data.usage_prices.filter(row => row.model_id === imagen.id).every(row => row.provider_id === 3 && row.price === 0.04));
  assert.ok(!f.data.usage_prices.some(row => row.price_kind === 'availability'));
  // Deprecated (shutdown 2027-03-15), still sold: its references stay available.
  const deprecated = f.data.models.find(row => row.slug === 'gemini-2.5-flash-image')!;
  assert.ok(f.data.usage_prices.filter(row => row.model_id === deprecated.id).every(row => row.is_available === true));
  const i45 = f.data.models.find(row => row.slug === 'ideogram-4.5')!;
  assert.equal(f.data.usage_prices.filter(row => row.model_id === i45.id).length, 8);
  const writes = f.writeCount();
  assert.deepEqual(await seedImageModels(f.tx, true), []);
  assert.equal(f.writeCount(), writes);
});

test('image seed CLI preview never connects', () => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-image-models-2026-10-15.ts'], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'invalid-offline-preview-must-not-connect' },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /DRY-RUN \(offline; no database connection\)/);
  assert.match(run.stdout, /gpt-image-2/);
});
