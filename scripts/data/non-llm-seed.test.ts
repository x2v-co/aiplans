import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { spawnSync } from 'node:child_process';
import { seedNonLlm } from './non-llm-seed';
import { NON_LLM_CATALOG } from '../../src/lib/non-llm-catalog';

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

test('dry-run is read-only, previews all prices and refuses ambiguous identities', async () => {
  const f = fixture();
  const before = structuredClone(f.data);
  const steps = await seedNonLlm(f.tx);
  assert.equal(steps.filter(step => step.table === 'models').length, NON_LLM_CATALOG.length);
  assert.ok(steps.some(step => step.target === 'grok-voice-3.0/speech_to_speech/minute'));
  assert.deepEqual(f.data, before);
  assert.equal(f.writeCount(), 0);
  const ambiguous = fixture({ models: [{ id: 1, slug: 'jev-1.14.0' }, { id: 2, slug: 'jev-1.14.0' }] });
  await assert.rejects(seedNonLlm(ambiguous.tx), /Ambiguous models\/jev-1.14.0/);
  assert.equal(ambiguous.writeCount(), 0);
});

test('apply is idempotent, scopes channel prices and updates every Moondream entry without altering its prices', async () => {
  const f = fixture({
    models: [
      { id: 1, slug: 'existing-moondream-2', name: 'Moondream 2', model_category: 'text', description: 'Keep original', open_source: true },
      { id: 2, slug: 'moondream-vision', name: 'Vision', model_category: 'image' },
      { id: 3, slug: 'unrelated', name: 'Unrelated', description: 'Keep unchanged' },
      { id: 4, slug: 'jev-1.14.0', type: 'llm', provider_ids: [999] },
    ],
    usage_prices: [{ id: 20, model_id: 1, price_kind: 'input_tokens', unit: 'per_1m_tokens', price: 123 }],
  });
  const unrelated = structuredClone(f.data.models[2]);
  const oldPrice = structuredClone(f.data.usage_prices[0]);
  await seedNonLlm(f.tx, true);
  assert.deepEqual(f.data.models[2], unrelated);
  assert.deepEqual(f.data.usage_prices[0], oldPrice);
  for (const model of f.data.models.filter(row => /moondream/.test(String(row.slug)))) {
    assert.equal(model.deprecated_at, '2026-11-13');
    assert.equal(model.shutdown_date, '2026-11-13');
    assert.match(String(model.description), /credits will be refunded; models stay open/);
  }
  assert.match(String(f.data.models[0].description), /Keep original/);
  const bySlug = (slug: string) => f.data.models.find(row => row.slug === slug)!;
  assert.ok((bySlug('jev-1.14.0').provider_ids as number[]).includes(999));
  const channel = f.data.providers.find(row => row.slug === 'vercel-ai-gateway')!;
  const microsoft = f.data.providers.find(row => row.slug === 'microsoft')!;
  const image = bySlug('microsoft-mai-image-2.6');
  assert.deepEqual(image.provider_ids, [microsoft.id]);
  const rates = f.data.usage_prices.filter(row => row.model_id === image.id);
  assert.ok(rates.every(row => row.provider_id === channel.id));
  assert.equal(rates.find(row => row.price_kind === 'input_tokens')?.price, 5);
  assert.equal(rates.find(row => row.price_kind === 'output_tokens')?.price, 38);
  assert.equal((rates.find(row => row.price_kind === 'image_starting')?.constraints_json as Record<string, unknown>).approximate, true);
  const jevRates = f.data.usage_prices.filter(row => row.model_id === bySlug('jev-1.14.0').id);
  assert.equal(jevRates.find(row => row.price_kind === 'output_tokens')?.price, 0);
  assert.equal(jevRates.find(row => row.price_kind === 'input_tokens')?.price, 0.042);
  // Itemized: TypeSafe has no per-task fee, so no null tasks row is invented.
  assert.equal(jevRates.some(row => row.price_kind === 'tasks'), false);
  const moondreamRates = f.data.usage_prices.filter(row => row.model_id === bySlug('moondream-cloud').id);
  assert.equal(moondreamRates.find(row => row.price_kind === 'moondream-3.1_realtime_output')?.price, 1);
  assert.equal(moondreamRates.find(row => row.price_kind === 'moondream-3-preview_batch_output')?.price, 1.25);
  assert.ok(f.data.plans.every(row => row.price === null && row.annual_price === null && row.source === 'manual'));
  assert.ok(f.data.model_plan_mapping.every(row => row.source === 'manual'));
  const transcribe = bySlug('grok-voice-transcribe-1.0');
  assert.equal(transcribe.shutdown_date, '2026-10-02');
  assert.equal(transcribe.replacement_model, 'grok-voice-transcribe-2.0');
  assert.ok(f.data.usage_prices.filter(row => row.model_id === transcribe.id).every(row => row.is_available === false));
  // Simulate postgres.js timestamp decoding before replaying the seed.
  for (const model of f.data.models) if (model.released_at) model.released_at = new Date(String(model.released_at));
  for (const table of ['plans', 'usage_prices']) for (const row of f.data[table]) if (row.last_verified) row.last_verified = new Date(String(row.last_verified));
  // JSONB equality must not depend on the key order returned by PostgreSQL.
  for (const row of f.data.usage_prices) if (row.constraints_json) {
    row.constraints_json = Object.fromEntries(Object.entries(row.constraints_json).reverse());
  }
  const writes = f.writeCount();
  assert.deepEqual(await seedNonLlm(f.tx, true), []);
  assert.equal(f.writeCount(), writes);
});

test('CLI default preview cannot import a database client and conflicting flags fail closed', () => {
  const run = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-non-llm-2026-10-15.ts', ...args], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'invalid-offline-preview-must-not-connect' },
  });
  const preview = run([]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /DRY-RUN \(offline; no database connection\)/);
  assert.match(preview.stdout, /grok-voice-3.0/);
  assert.match(preview.stdout, /existingMoondreamUpdates/);
  const conflict = run(['--apply', '--dry-run']);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /Usage:/);
});

test('grok-voice-transcribe 2.0 and 1.0 are billed per hour', async () => {
  const { NON_LLM_CATALOG } = await import('../../src/lib/non-llm-catalog');
  for (const slug of ['grok-voice-transcribe-2.0', 'grok-voice-transcribe-1.0']) {
    const item = NON_LLM_CATALOG.find(i => i.slug === slug)!;
    assert.equal(item.pricingUnit, 'per_hour');
    assert.ok(item.usageRates?.every(r => r.unit === 'hour'));
  }
});
